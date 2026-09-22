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

// `language: "en"` below is a strong bias, not a hard guarantee — on short
// or ambiguous clips Whisper sometimes still decides the sound is some
// other language and transliterates it into that script (the same word
// coming back as "Babi" / "भाभी" / "بابي" / "ভাবি" across chunks is this,
// not four different words). This app only wants English, so any letter
// from one of these scripts means the clip was mis-heard, not that someone
// asked a question in Hindi — discard it rather than acting on it.
const NON_LATIN_SCRIPT =
  /\p{Script=Devanagari}|\p{Script=Bengali}|\p{Script=Gurmukhi}|\p{Script=Gujarati}|\p{Script=Arabic}|\p{Script=Hebrew}|\p{Script=Cyrillic}|\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}|\p{Script=Thai}|\p{Script=Armenian}|\p{Script=Georgian}|\p{Script=Greek}/u;

// Whisper/gpt-4o-transcribe both take this as a soft bias on vocabulary,
// not a transcript to follow — worth it because the exact jargon it tends
// to mangle without a hint ("hooks", "useCallback", "Context API") is
// precisely the vocabulary RANA's own sessions are about.
//
// Kept short and non-sentence-like on purpose: a prompt that reads like
// plausible spoken dialogue (a full paragraph) gets echoed back verbatim
// as the "transcription" on quiet/ambiguous audio chunks — that's a known
// Whisper hallucination mode, and it's what caused the "same question
// asked over and over" bug (the prompt itself was being detected as the
// question, repeatedly). A bare keyword list is much less likely to be
// mistaken for something someone said.
const DOMAIN_PROMPT =
  "React hooks useState useEffect useCallback Context API JavaScript TypeScript " +
  "async await promises AWS Azure system design database API";

// Punctuation-insensitive form for echo detection below — Whisper reformats
// the word list with commas/slashes ("async/await") when it echoes it, so
// comparing raw strings misses the echo. Compare on words only instead.
function normalizeWords(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
const NORMALIZED_PROMPT = normalizeWords(DOMAIN_PROMPT);

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
      // Without this, Whisper is free to auto-detect language per chunk —
      // on quiet/ambiguous audio it doesn't fall back to "no confident
      // guess", it picks *some* language and transcribes phonetically into
      // it (Chinese, Cyrillic, Urdu, whatever), which is exactly the "why
      // is it showing random languages" symptom. Pinning this forces it to
      // always decode as English, the one thing this app actually needs.
      language: "en",
      prompt: DOMAIN_PROMPT,
    });
    const text = "text" in result ? (result.text ?? "").trim() : "";
    // Defensive: if the model echoed a chunk of the prompt back as the
    // "transcription" — the hallucination this prompt is now shaped to
    // avoid, but not guaranteed to eliminate — treat it as silence rather
    // than feeding a fake question into detection. Length-gated so a real,
    // short utterance that happens to share a word with the prompt (e.g.
    // someone just saying "React") isn't discarded.
    if (text.length > 20 && NORMALIZED_PROMPT.includes(normalizeWords(text))) return "";
    if (NON_LATIN_SCRIPT.test(text)) return "";
    return text;
  }
}
