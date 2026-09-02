import { getLLMProvider } from "@/lib/ai/llm";
import { TaskHint } from "@/lib/ai/llm/types";
import { PromptContext } from "@/lib/ai/prompts/types";
import { getSystemPrompt } from "@/lib/ai/prompts/system";
import { answerGenerationTaskPrompt } from "@/lib/ai/prompts/tasks/answer-generation.prompt";
import { AIResponsePayload, AIResponsePayloadSchema, QuestionType, parseAndValidate } from "@/lib/ai/schemas";

const TASK_HINT_BY_TYPE: Record<QuestionType, TaskHint> = {
  TECHNICAL: "technical",
  CODING: "coding",
  SYSTEM_DESIGN: "system-design",
  BEHAVIORAL: "behavioral",
  CLARIFICATION: "technical",
  FOLLOW_UP: "technical",
  MEETING_TOPIC: "meeting",
  NO_ACTION: "technical",
};

export type ResponseGenerationEvent =
  | { kind: "partial"; textSoFar: string }
  | { kind: "complete"; payload: AIResponsePayload; raw: string }
  | { kind: "error"; message: string };

/**
 * Streams a structured AI response for a detected question (or a manual
 * "Ask AI" request). Yields `partial` events as raw text arrives (drives the
 * "AI is thinking/typing" UI), then a single `complete` event once the
 * accumulated text has been parsed and validated against the response
 * schema. Falls back to one repair attempt if the first parse fails, then
 * surfaces a clean `error` event rather than throwing malformed data at the UI.
 */
export async function* generateResponse(params: {
  questionType: QuestionType;
  questionText: string;
  context: PromptContext;
  manualInstruction?: string;
  signal?: AbortSignal;
}): AsyncGenerator<ResponseGenerationEvent, void, unknown> {
  const provider = getLLMProvider();
  const taskHint: TaskHint = params.manualInstruction ? "manual" : TASK_HINT_BY_TYPE[params.questionType];

  const messages = [
    { role: "system" as const, content: getSystemPrompt(params.context) },
    {
      role: "user" as const,
      content: answerGenerationTaskPrompt({
        questionType: params.questionType,
        questionText: params.questionText,
        manualInstruction: params.manualInstruction,
      }),
    },
  ];

  let accumulated = "";
  try {
    for await (const chunk of provider.stream(messages, {
      jsonMode: true,
      temperature: 0.4,
      maxTokens: 700,
      taskHint,
      signal: params.signal,
    })) {
      accumulated += chunk;
      yield { kind: "partial", textSoFar: accumulated };
    }
  } catch (err) {
    if (params.signal?.aborted) return;
    yield { kind: "error", message: err instanceof Error ? err.message : "AI generation failed" };
    return;
  }

  const firstAttempt = parseAndValidate(accumulated, AIResponsePayloadSchema);
  if (firstAttempt.ok) {
    yield { kind: "complete", payload: firstAttempt.data, raw: accumulated };
    return;
  }

  if (params.signal?.aborted) return;

  // One repair attempt: ask the model to fix its own output into valid JSON.
  try {
    const repaired = await provider.generate(
      [
        { role: "system", content: "You fix malformed JSON. Return ONLY the corrected JSON object, nothing else." },
        { role: "user", content: accumulated },
      ],
      { jsonMode: true, temperature: 0, maxTokens: 700, signal: params.signal }
    );
    const secondAttempt = parseAndValidate(repaired, AIResponsePayloadSchema);
    if (secondAttempt.ok) {
      yield { kind: "complete", payload: secondAttempt.data, raw: repaired };
      return;
    }
  } catch {
    // fall through to error below
  }

  yield { kind: "error", message: "AI response couldn't be generated. Your transcript is still being captured." };
}
