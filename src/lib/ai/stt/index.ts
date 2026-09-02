import { STTProvider } from "./types";
import { OpenAISTTProvider } from "./openai-stt-provider";
import { MockSTTProvider } from "./mock-stt-provider";

let cached: STTProvider | null = null;

/** Mirrors lib/ai/llm/index.ts's factory pattern — same key, same fallback philosophy. */
export function getSTTProvider(): STTProvider {
  if (cached) return cached;

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    cached = new OpenAISTTProvider(apiKey, process.env.OPENAI_STT_MODEL || "gpt-4o-mini-transcribe");
  } else {
    console.warn("[stt] OPENAI_API_KEY not set — cloud transcription chunks will be silently dropped.");
    cached = new MockSTTProvider();
  }
  return cached;
}

export type { STTProvider } from "./types";
