import OpenAI, { toFile } from "openai";
import { STTProvider } from "./types";

const EXTENSION_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/mpeg": "mp3",
};

function extensionFor(mimeType: string): string {
  const base = mimeType.split(";")[0].trim();
  return EXTENSION_BY_MIME[base] ?? "webm";
}

export class OpenAISTTProvider implements STTProvider {
  readonly id = "openai";
  readonly isMock = false;

  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async transcribe(audio: Buffer, mimeType: string): Promise<string> {
    const file = await toFile(audio, `chunk.${extensionFor(mimeType)}`, { type: mimeType });
    const result = await this.client.audio.transcriptions.create({
      file,
      model: this.model,
      response_format: "json",
    });
    return "text" in result ? (result.text ?? "").trim() : "";
  }
}
