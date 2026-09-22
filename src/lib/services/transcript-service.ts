import { prisma } from "@/lib/db/prisma";
import { sessionBus } from "@/lib/events/session-bus";
import { buildPromptContext, maybeCompactContext, mergeDetectedTechnologies } from "@/lib/ai/context-engine";
import { detectQuestion } from "@/lib/ai/question-detector";
import { generateResponse } from "@/lib/ai/response-generator";
import { RESPONSE_TYPE_TO_ENUM } from "@/lib/ai/schemas";
import { Speaker } from "@prisma/client";
import { logger, LogEvent } from "@/lib/observability/logger";

const DEBOUNCE_MS = 900;
const MAX_BUFFER_CHARS = 600;

interface RuntimeState {
  buffer: string[];
  timer: NodeJS.Timeout | null;
  abortController: AbortController | null;
  generationSeq: number;
}

const runtime = new Map<string, RuntimeState>();

function getRuntime(sessionId: string): RuntimeState {
  let state = runtime.get(sessionId);
  if (!state) {
    state = { buffer: [], timer: null, abortController: null, generationSeq: 0 };
    runtime.set(sessionId, state);
  }
  return state;
}

export function clearRuntime(sessionId: string): void {
  const state = runtime.get(sessionId);
  if (state?.timer) clearTimeout(state.timer);
  state?.abortController?.abort();
  runtime.delete(sessionId);
}

export interface IngestParams {
  sessionId: string;
  speaker: Speaker;
  text: string;
  isFinal: boolean;
  startMs: number;
  endMs?: number;
}

/**
 * Ingests one transcript chunk from the client's speech recognizer. Partial
 * chunks are only broadcast (for the live-typing UI); final chunks are
 * persisted and fed into an intelligent debounce buffer so the assistant
 * reacts to a complete thought rather than every utterance fragment
 * (MASTER BUILD PROMPT section 3).
 */
export async function ingestTranscriptChunk(params: IngestParams) {
  if (!params.isFinal) {
    sessionBus.publish(params.sessionId, {
      type: "transcript.partial",
      segmentId: "partial",
      speaker: params.speaker,
      text: params.text,
    });
    return { persisted: false };
  }

  const segment = await prisma.transcriptSegment.create({
    data: {
      sessionId: params.sessionId,
      speaker: params.speaker,
      text: params.text,
      isFinal: true,
      startMs: params.startMs,
      endMs: params.endMs,
    },
  });

  sessionBus.publish(params.sessionId, {
    type: "transcript.final",
    segmentId: segment.id,
    speaker: params.speaker,
    text: params.text,
    startMs: params.startMs,
  });

  // Log metadata only (length, speaker) — never the transcript text itself.
  logger.info(LogEvent.TranscriptIngested, { sessionId: params.sessionId, speaker: params.speaker, chars: params.text.length });

  await mergeDetectedTechnologies(params.sessionId, params.text);
  await maybeCompactContext(params.sessionId);

  // Only the interviewer/other-party speech should trigger auto-assistance;
  // the user's own speech is transcribed but not treated as a question.
  if (params.speaker === Speaker.INTERVIEWER || params.speaker === Speaker.UNKNOWN) {
    scheduleDebouncedDetection(params.sessionId, params.text);
  }

  return { persisted: true, segmentId: segment.id };
}

function scheduleDebouncedDetection(sessionId: string, text: string) {
  const state = getRuntime(sessionId);
  state.buffer.push(text);
  if (state.timer) clearTimeout(state.timer);

  const combined = state.buffer.join(" ");
  const shouldFlushNow = combined.length >= MAX_BUFFER_CHARS || /[?]\s*$/.test(text.trim());

  const flush = async () => {
    const chunk = state.buffer.join(" ").trim();
    state.buffer = [];
    state.timer = null;
    if (chunk.length > 0) {
      await runDetectionAndRespond(sessionId, chunk);
    }
  };

  if (shouldFlushNow) {
    void flush();
  } else {
    state.timer = setTimeout(() => void flush(), DEBOUNCE_MS);
  }
}

async function runDetectionAndRespond(sessionId: string, chunk: string) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: { include: { preference: true } } },
    });
    if (!session || session.status !== "ACTIVE") return;

    const context = await buildPromptContext(sessionId);
    const detection = await detectQuestion(chunk, context);
    if (!detection) return;

    const question = await prisma.question.create({
      data: {
        sessionId,
        type: detection.type,
        confidence: detection.confidence,
        questionText: detection.question,
      },
    });

    sessionBus.publish(sessionId, {
      type: "question.detected",
      questionId: question.id,
      questionType: detection.type,
      confidence: detection.confidence,
      question: detection.question,
    });
    logger.info(LogEvent.QuestionDetected, { sessionId, questionId: question.id, type: detection.type, confidence: detection.confidence });

    const autoAnswer = session.user.preference?.autoAnswer ?? true;
    if (!autoAnswer) return;

    await streamAndPersistResponse(sessionId, {
      questionId: question.id,
      questionType: detection.type,
      questionText: detection.question,
    });
  } catch (err) {
    sessionBus.publish(sessionId, {
      type: "error",
      message: "AI response couldn't be generated. Your transcript is still being captured.",
      scope: "ai",
    });
    logger.error(LogEvent.AIProviderFailure, {
      sessionId,
      stage: "detection",
      message: err instanceof Error ? err.message : "unknown error",
    });
  }
}

/**
 * Streams and persists a structured response for either an auto-detected
 * question or a manual "Ask AI" request. Cancels any in-flight generation
 * for the session first, so a topic change never lets a stale response
 * flood the UI (section 22).
 */
export async function streamAndPersistResponse(
  sessionId: string,
  params: {
    questionId: string | null;
    questionType: import("@/lib/ai/schemas").QuestionType;
    questionText: string;
    manualInstruction?: string;
    imageDataUrl?: string;
  }
) {
  const state = getRuntime(sessionId);
  state.abortController?.abort();
  const abortController = new AbortController();
  state.abortController = abortController;
  const mySeq = ++state.generationSeq;

  sessionBus.publish(sessionId, { type: "ai.thinking", questionId: params.questionId });

  const context = await buildPromptContext(sessionId);
  const startedAt = Date.now();

  for await (const event of generateResponse({
    questionType: params.questionType,
    questionText: params.questionText,
    context,
    manualInstruction: params.manualInstruction,
    imageDataUrl: params.imageDataUrl,
    signal: abortController.signal,
  })) {
    if (state.generationSeq !== mySeq) return; // superseded by a newer generation

    if (event.kind === "partial") {
      sessionBus.publish(sessionId, {
        type: "ai.response.partial",
        questionId: params.questionId,
        textSoFar: event.textSoFar,
      });
    } else if (event.kind === "complete") {
      const latencyMs = Date.now() - startedAt;
      const response = await prisma.aIResponse.create({
        data: {
          sessionId,
          questionId: params.questionId,
          type: RESPONSE_TYPE_TO_ENUM[event.payload.type] as never,
          payload: event.payload,
          latencyMs,
        },
      });
      sessionBus.publish(sessionId, {
        type: "ai.response.complete",
        questionId: params.questionId,
        responseId: response.id,
        payload: event.payload,
      });
      logger.info(LogEvent.AIResponseGenerated, { sessionId, responseId: response.id, type: event.payload.type, latencyMs });
    } else if (event.kind === "error") {
      sessionBus.publish(sessionId, { type: "error", message: event.message, scope: "ai" });
      logger.error(LogEvent.AIProviderFailure, { sessionId, stage: "generation", message: event.message });
    }
  }
}
