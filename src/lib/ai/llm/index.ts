import { LLMProvider } from "./types";
import { OpenAIProvider } from "./openai-provider";
import { MockLLMProvider } from "./mock-provider";

let cached: LLMProvider | null = null;

/**
 * Factory for the configured LLM provider. Falls back to the mock provider
 * (clearly labeled, never silently pretending to be real) whenever
 * OPENAI_API_KEY is absent, so the app stays fully functional in dev and the
 * real provider can be connected later with zero code changes.
 */
export function getLLMProvider(): LLMProvider {
  if (cached) return cached;

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    cached = new OpenAIProvider(apiKey, process.env.OPENAI_MODEL || "gpt-4o-mini");
  } else {
    console.warn(
      "[ai] OPENAI_API_KEY not set — using MockLLMProvider. Set OPENAI_API_KEY in .env to get real responses."
    );
    cached = new MockLLMProvider();
  }
  return cached;
}

export type { LLMProvider, LLMMessage, LLMGenerateOptions, TaskHint } from "./types";
export { LLMProviderError } from "./types";
