import { NextRequest, NextResponse } from "next/server";
import { Speaker } from "@prisma/client";
import { getSTTProvider } from "@/lib/ai/stt";
import { ingestTranscriptChunk } from "@/lib/services/transcript-service";
import { checkRateLimit } from "@/lib/http/rate-limit";
import { apiError } from "@/lib/http/api-error";
import { logger } from "@/lib/observability/logger";

// A few seconds of compressed audio at typical MediaRecorder bitrates —
// generous enough for real chunks, small enough to block abuse.
const MAX_CHUNK_BYTES = 5 * 1024 * 1024;
// Below this, a chunk is almost certainly silence/near-silence — skip the
// API call entirely rather than pay for (and risk a Whisper hallucination
// on) transcribing near-nothing.
const MIN_CHUNK_BYTES = 2000;

function toSpeaker(value: string | null): Speaker {
  if (value === "USER") return Speaker.USER;
  if (value === "INTERVIEWER") return Speaker.INTERVIEWER;
  return Speaker.UNKNOWN;
}

/**
 * Server-side speech-to-text for contexts where the browser's free Web
 * Speech API doesn't work (the Electron desktop HUD — see lib/ai/stt/
 * types.ts for why). The client (useCloudTranscription.ts) posts short raw
 * audio chunks here; this route transcribes one via the configured
 * STTProvider and feeds the text into the *same* ingestTranscriptChunk
 * pipeline the Web Speech path uses — question detection, AI response
 * generation, and the SSE broadcast are not duplicated for this path.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;

  if (!checkRateLimit(`transcribe-chunk:${sessionId}`, 30, 60_000)) {
    return apiError(429, "Too many audio chunks — slow down.");
  }

  const speaker = toSpeaker(req.nextUrl.searchParams.get("speaker"));
  const startMs = Number(req.nextUrl.searchParams.get("startMs") ?? "0") || 0;
  const contentType = req.headers.get("content-type") || "audio/webm";

  const arrayBuffer = await req.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_CHUNK_BYTES) {
    return apiError(413, "Audio chunk too large.");
  }
  if (arrayBuffer.byteLength < MIN_CHUNK_BYTES) {
    return NextResponse.json({ transcribed: false, reason: "chunk too small" });
  }

  try {
    const provider = getSTTProvider();
    const text = await provider.transcribe(Buffer.from(arrayBuffer), contentType);
    if (!text) {
      return NextResponse.json({ transcribed: false });
    }

    const result = await ingestTranscriptChunk({
      sessionId,
      speaker,
      text,
      isFinal: true,
      startMs: Number.isFinite(startMs) ? startMs : 0,
    });
    return NextResponse.json({ transcribed: true, ...result });
  } catch (err) {
    logger.error("stt.transcribe_failed", { sessionId, message: err instanceof Error ? err.message : "unknown error" });
    return apiError(500, "Transcription failed for this audio chunk", err);
  }
}
