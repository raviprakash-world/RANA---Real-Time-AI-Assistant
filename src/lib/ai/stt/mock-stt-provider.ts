import { STTProvider } from "./types";

/**
 * Used when OPENAI_API_KEY isn't configured. Unlike MockLLMProvider (which
 * returns clearly-labeled placeholder answers so the AI pipeline stays
 * exercisable), fabricating "heard" speech the user never said would
 * actively pollute the transcript/history with fictional content — so this
 * just drops the chunk. The route layer treats an empty result as "nothing
 * to ingest," same as a silent/near-empty audio chunk.
 */
export class MockSTTProvider implements STTProvider {
  readonly id = "mock";
  readonly isMock = true;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature must match STTProvider
  async transcribe(audio: Buffer, mimeType: string): Promise<string> {
    return "";
  }
}
