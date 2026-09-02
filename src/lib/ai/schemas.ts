import { z } from "zod";

export const QuestionTypeSchema = z.enum([
  "TECHNICAL",
  "CODING",
  "SYSTEM_DESIGN",
  "BEHAVIORAL",
  "CLARIFICATION",
  "FOLLOW_UP",
  "MEETING_TOPIC",
  "NO_ACTION",
]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const QuestionDetectionSchema = z.object({
  type: QuestionTypeSchema,
  confidence: z.number().min(0).max(1),
  question: z.string(),
});
export type QuestionDetection = z.infer<typeof QuestionDetectionSchema>;

export const TechnicalAnswerSchema = z.object({
  type: z.literal("technical_answer"),
  title: z.string().default("Suggested Answer"),
  direct_answer: z.string(),
  key_points: z.array(z.string()).default([]),
  example: z.string().optional().default(""),
  tradeoffs: z.array(z.string()).default([]),
  follow_up_questions: z.array(z.string()).default([]),
});

export const CodingAnswerSchema = z.object({
  type: z.literal("coding_answer"),
  problem: z.string(),
  approach: z.string(),
  complexity: z.object({ time: z.string(), space: z.string() }),
  code: z.string(),
  edge_cases: z.array(z.string()).default([]),
  explanation: z.string().optional().default(""),
});

export const SystemDesignAnswerSchema = z.object({
  type: z.literal("system_design_answer"),
  requirements: z.array(z.string()).default([]),
  architecture: z.string(),
  components: z.array(z.string()).default([]),
  data_flow: z.string().optional().default(""),
  apis: z.array(z.string()).default([]),
  database: z.string().optional().default(""),
  scaling: z.string().optional().default(""),
  caching: z.string().optional().default(""),
  failure_handling: z.string().optional().default(""),
  tradeoffs: z.array(z.string()).default([]),
});

export const BehavioralAnswerSchema = z.object({
  type: z.literal("behavioral_answer"),
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
  key_points: z.array(z.string()).default([]),
  example_answer: z.string(),
});

export const MeetingNotesSchema = z.object({
  type: z.literal("meeting_notes"),
  key_points: z.array(z.string()).default([]),
  decisions: z.array(z.string()).default([]),
  action_items: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  questions_to_ask: z.array(z.string()).default([]),
});

export const ManualAnswerSchema = z.object({
  type: z.literal("manual"),
  answer: z.string(),
  key_points: z.array(z.string()).default([]),
});

export const AIResponsePayloadSchema = z.discriminatedUnion("type", [
  TechnicalAnswerSchema,
  CodingAnswerSchema,
  SystemDesignAnswerSchema,
  BehavioralAnswerSchema,
  MeetingNotesSchema,
  ManualAnswerSchema,
]);
export type AIResponsePayload = z.infer<typeof AIResponsePayloadSchema>;

export const SessionSummarySchema = z.object({
  topics: z.array(z.string()).default([]),
  questions_asked: z
    .array(z.object({ question: z.string(), type: z.string() }))
    .default([]),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  action_items: z.array(z.string()).default([]),
  raw_summary: z.string(),
});
export type SessionSummaryPayload = z.infer<typeof SessionSummarySchema>;

/** Maps a structured payload's `type` field to the Prisma AIResponseType enum value. */
export const RESPONSE_TYPE_TO_ENUM: Record<AIResponsePayload["type"], string> = {
  technical_answer: "TECHNICAL_ANSWER",
  coding_answer: "CODING_ANSWER",
  system_design_answer: "SYSTEM_DESIGN_ANSWER",
  behavioral_answer: "BEHAVIORAL_ANSWER",
  meeting_notes: "MEETING_NOTES",
  manual: "MANUAL",
};

/**
 * Parses raw LLM text as JSON and validates it against a schema. Strips
 * markdown code fences some models add even in JSON mode.
 */
export function parseAndValidate<T extends z.ZodTypeAny>(
  raw: string,
  schema: T
): { ok: true; data: z.infer<T> } | { ok: false; error: string } {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const json = JSON.parse(cleaned);
    const result = schema.safeParse(json);
    if (!result.success) {
      return { ok: false, error: result.error.message };
    }
    return { ok: true, data: result.data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" };
  }
}
