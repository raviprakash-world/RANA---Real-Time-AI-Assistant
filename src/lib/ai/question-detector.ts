import { getLLMProvider } from "@/lib/ai/llm";
import { PromptContext } from "@/lib/ai/prompts/types";
import { getSystemPrompt } from "@/lib/ai/prompts/system";
import { questionDetectionTaskPrompt } from "@/lib/ai/prompts/tasks/question-detection.prompt";
import { QuestionDetection, QuestionDetectionSchema, parseAndValidate } from "@/lib/ai/schemas";

const CONFIDENCE_THRESHOLD = 0.6;

/**
 * Classifies a buffered chunk of transcript. Returns null when nothing
 * actionable was found (NO_ACTION or below-threshold confidence), so callers
 * never trigger AI generation for filler/small talk (section 26).
 */
export async function detectQuestion(
  transcriptChunk: string,
  ctx: PromptContext
): Promise<QuestionDetection | null> {
  const provider = getLLMProvider();

  const raw = await provider.generate(
    [
      { role: "system", content: getSystemPrompt(ctx) },
      { role: "user", content: questionDetectionTaskPrompt(transcriptChunk) },
    ],
    { jsonMode: true, temperature: 0.1, maxTokens: 300, taskHint: "question-detection" }
  );

  const parsed = parseAndValidate(raw, QuestionDetectionSchema);
  if (!parsed.ok) return null;

  if (parsed.data.type === "NO_ACTION") return null;
  if (parsed.data.confidence < CONFIDENCE_THRESHOLD) return null;

  return parsed.data;
}
