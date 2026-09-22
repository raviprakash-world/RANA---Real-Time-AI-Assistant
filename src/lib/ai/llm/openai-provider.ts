import OpenAI from "openai";
import {
  LLMGenerateOptions,
  LLMMessage,
  LLMProvider,
  LLMProviderError,
} from "./types";

/**
 * Real LLM provider backed by the OpenAI API. Server-side only — the API
 * key never leaves the server process (never import this file from a
 * client component).
 */
export class OpenAIProvider implements LLMProvider {
  readonly id = "openai";
  readonly isMock = false;

  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generate(messages: LLMMessage[], opts: LLMGenerateOptions = {}): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
          temperature: opts.temperature ?? 0.4,
          max_tokens: opts.maxTokens ?? 700,
          response_format: opts.jsonMode ? { type: "json_object" } : undefined,
        },
        { signal: opts.signal }
      );
      return completion.choices[0]?.message?.content ?? "";
    } catch (err) {
      throw toProviderError(err);
    }
  }

  async *stream(
    messages: LLMMessage[],
    opts: LLMGenerateOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    try {
      const stream = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
          temperature: opts.temperature ?? 0.4,
          max_tokens: opts.maxTokens ?? 700,
          response_format: opts.jsonMode ? { type: "json_object" } : undefined,
          stream: true,
        },
        { signal: opts.signal }
      );

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
    } catch (err) {
      throw toProviderError(err);
    }
  }
}

function toProviderError(err: unknown): LLMProviderError {
  if (err instanceof OpenAI.APIError) {
    const retryable = err.status === 429 || (err.status ?? 500) >= 500;
    return new LLMProviderError(`OpenAI API error: ${err.message}`, err, retryable);
  }
  if (err instanceof Error && err.name === "AbortError") {
    return new LLMProviderError("Request aborted", err, false);
  }
  return new LLMProviderError("Unexpected OpenAI provider failure", err, true);
}
