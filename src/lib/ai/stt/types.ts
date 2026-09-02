/**
 * Provider-agnostic speech-to-text interface — the audio-side counterpart
 * to lib/ai/llm/. Exists because the browser's free Web Speech API
 * (useSpeechRecognition.ts) doesn't work everywhere: Google blocks its
 * server-side recognition backend for any non-Chrome embedder, which
 * includes Electron — confirmed live, traced through macOS's own audio/TCC
 * logs, during this project's build (see chat history / README). The
 * desktop HUD needs a real server-side transcription path instead.
 */
export interface STTProvider {
  readonly id: string;
  readonly isMock: boolean;
  /** `audio` is one short chunk (a few seconds), not a long-running stream. */
  transcribe(audio: Buffer, mimeType: string): Promise<string>;
}
