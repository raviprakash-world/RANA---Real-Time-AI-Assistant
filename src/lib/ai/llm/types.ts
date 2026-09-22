export type LLMRole = "system" | "user" | "assistant";

/** Mirrors OpenAI's chat content-part shape so it passes through unchanged. */
export type LLMContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface LLMMessage {
  role: LLMRole;
  /** Array form is for a user message carrying an image (e.g. a screenshot) alongside text. */
  content: string | LLMContentPart[];
}

export type TaskHint =
  | "question-detection"
  | "technical"
  | "coding"
  | "system-design"
  | "behavioral"
  | "meeting"
  | "manual"
  | "summary";

export interface LLMGenerateOptions {
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider to return a single JSON object (no prose, no markdown fences). */
  jsonMode?: boolean;
  /** Only consulted by the mock provider, to shape a plausible canned reply. */
  taskHint?: TaskHint;
  signal?: AbortSignal;
}

/**
 * Provider-agnostic interface for the LLM layer. Everything in the AI
 * pipeline (question detection, answer generation, summaries) is written
 * against this interface, never against a specific vendor SDK, so swapping
 * providers (or running multiple side by side) never requires touching
 * application code — see lib/ai/llm/index.ts for the factory.
 */
export interface LLMProvider {
  readonly id: string;
  readonly isMock: boolean;
  generate(messages: LLMMessage[], opts?: LLMGenerateOptions): Promise<string>;
  stream(
    messages: LLMMessage[],
    opts?: LLMGenerateOptions
  ): AsyncGenerator<string, void, unknown>;
}

export class LLMProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly retryable = true
  ) {
    super(message);
    this.name = "LLMProviderError";
  }
}
