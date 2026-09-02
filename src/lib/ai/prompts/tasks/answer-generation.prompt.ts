import { QuestionType } from "@/lib/ai/schemas";

const SHAPES: Record<string, string> = {
  technical: `{
  "type": "technical_answer",
  "title": "Suggested Answer",
  "direct_answer": "2-4 speakable sentences",
  "key_points": ["short bullet", "..."],
  "example": "optional short concrete example",
  "tradeoffs": ["optional tradeoff", "..."],
  "follow_up_questions": ["a likely follow-up question", "..."]
}`,
  coding: `{
  "type": "coding_answer",
  "problem": "restated problem in one line",
  "approach": "1-3 sentences describing the approach",
  "complexity": { "time": "O(...)", "space": "O(...)" },
  "code": "concise, correct code solving the problem",
  "edge_cases": ["edge case", "..."],
  "explanation": "1-2 sentence explanation of why it works"
}`,
  system_design: `{
  "type": "system_design_answer",
  "requirements": ["clarified requirement", "..."],
  "architecture": "1-3 sentence high-level architecture description",
  "components": ["component", "..."],
  "data_flow": "short description",
  "apis": ["METHOD /path — purpose", "..."],
  "database": "short description",
  "scaling": "short description",
  "caching": "short description",
  "failure_handling": "short description",
  "tradeoffs": ["tradeoff", "..."]
}`,
  behavioral: `{
  "type": "behavioral_answer",
  "situation": "1 sentence",
  "task": "1 sentence",
  "action": "1-2 sentences",
  "result": "1 sentence, quantified if possible",
  "key_points": ["point", "..."],
  "example_answer": "a fully spoken-out STAR answer, 4-8 sentences"
}`,
  meeting: `{
  "type": "meeting_notes",
  "key_points": ["point", "..."],
  "decisions": ["decision", "..."],
  "action_items": ["action item", "..."],
  "risks": ["risk", "..."],
  "questions_to_ask": ["clarifying question", "..."]
}`,
  manual: `{
  "type": "manual",
  "answer": "direct, concise, speakable answer to the user's request",
  "key_points": ["optional supporting point", "..."]
}`,
};

const TYPE_TO_SHAPE_KEY: Record<QuestionType, keyof typeof SHAPES> = {
  TECHNICAL: "technical",
  CODING: "coding",
  SYSTEM_DESIGN: "system_design",
  BEHAVIORAL: "behavioral",
  CLARIFICATION: "technical",
  FOLLOW_UP: "technical",
  MEETING_TOPIC: "meeting",
  NO_ACTION: "technical",
};

export function answerGenerationTaskPrompt(params: {
  questionType: QuestionType;
  questionText: string;
  manualInstruction?: string;
}): string {
  const shapeKey = params.manualInstruction ? "manual" : TYPE_TO_SHAPE_KEY[params.questionType];
  const shape = SHAPES[shapeKey];

  const instructionLine = params.manualInstruction
    ? `The user directly asked the assistant: "${params.manualInstruction}"`
    : `Generate assistance for this detected question: "${params.questionText}"`;

  return `${instructionLine}

Return ONLY a JSON object with exactly this shape (omit nothing, use empty arrays/strings
if not applicable):
${shape}

Rules:
- Optimize for being spoken aloud in a live conversation: short, natural sentences.
- Be concise. Do not write essays. Do not repeat the question back at length.
- Do not fabricate facts, APIs, or benchmarks you're not confident about.`;
}
