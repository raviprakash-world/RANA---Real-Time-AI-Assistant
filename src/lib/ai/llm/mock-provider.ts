import { LLMGenerateOptions, LLMMessage, LLMProvider, TaskHint } from "./types";

/**
 * Deterministic, clearly-labeled mock provider used whenever OPENAI_API_KEY
 * is not configured. It returns well-formed, schema-valid JSON for every
 * task so the entire pipeline (detection -> generation -> validation ->
 * rendering) is exercised end to end without a real API key. Every payload
 * it produces is tagged so the UI can show a "mock AI" indicator instead of
 * silently pretending to be real.
 */
export class MockLLMProvider implements LLMProvider {
  readonly id = "mock";
  readonly isMock = true;

  async generate(messages: LLMMessage[], opts: LLMGenerateOptions = {}): Promise<string> {
    return buildMockPayload(messages, opts.taskHint);
  }

  async *stream(
    messages: LLMMessage[],
    opts: LLMGenerateOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const full = buildMockPayload(messages, opts.taskHint);
    const chunkSize = 24;
    for (let i = 0; i < full.length; i += chunkSize) {
      if (opts.signal?.aborted) return;
      yield full.slice(i, i + chunkSize);
      await new Promise((r) => setTimeout(r, 15));
    }
  }
}

function lastUserContent(messages: LLMMessage[]): string {
  const content = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (typeof content === "string") return content;
  // Array content is a user message with an image attached (e.g. a
  // screenshot) — mock mode has no vision, so just use the text part.
  return content.filter((p) => p.type === "text").map((p) => p.text).join(" ");
}

/**
 * Our task prompts wrap the actual question/instruction in double quotes
 * (e.g. `asked the assistant: "..."`). Prefer that focused excerpt over the
 * full prompt (which also contains the JSON-shape instructions) so mock
 * answers read like answers, not like an echo of the prompt.
 */
function extractSalientText(fullPrompt: string): string {
  const match = fullPrompt.match(/"([^"]{3,240})"/);
  return (match ? match[1] : fullPrompt.slice(0, 240)).trim();
}

function buildMockPayload(messages: LLMMessage[], taskHint?: TaskHint): string {
  const userText = extractSalientText(lastUserContent(messages)).replace(/"/g, "'");

  switch (taskHint) {
    case "question-detection":
      return JSON.stringify({
        type: /\b(design|scale|architecture)\b/i.test(userText)
          ? "SYSTEM_DESIGN"
          : /\b(function|algorithm|array|complexity|code|leetcode)\b/i.test(userText)
          ? "CODING"
          : /\b(tell me about a time|describe a situation|conflict|challenge)\b/i.test(userText)
          ? "BEHAVIORAL"
          : "TECHNICAL",
        confidence: 0.82,
        question: userText || "Detected question",
      });

    case "coding":
      return JSON.stringify({
        type: "coding_answer",
        problem: userText || "Coding problem",
        approach: "[mock] Use a hash map to track seen values in a single pass.",
        complexity: { time: "O(n)", space: "O(n)" },
        code: "function solve(nums) {\n  const seen = new Set();\n  for (const n of nums) {\n    if (seen.has(n)) return true;\n    seen.add(n);\n  }\n  return false;\n}",
        edge_cases: ["Empty input", "Single element", "All duplicates"],
        explanation: "[mock] One linear pass, constant-time lookups via the set.",
      });

    case "system-design":
      return JSON.stringify({
        type: "system_design_answer",
        requirements: ["Clarify scale (users/day)", "Latency targets", "Consistency needs"],
        architecture: "[mock] Client -> API gateway -> service -> queue -> workers -> datastore.",
        components: ["API gateway", "Notification service", "Message queue", "Worker pool", "Datastore"],
        data_flow: "Request enqueues a job; workers consume and deliver asynchronously.",
        apis: ["POST /notifications", "GET /notifications/:id/status"],
        database: "Postgres for state, Redis for hot lookups.",
        scaling: "Scale workers horizontally behind the queue.",
        caching: "Cache templates and recipient preferences.",
        failure_handling: "Retries with backoff + dead-letter queue.",
        tradeoffs: ["At-least-once delivery vs added complexity of idempotency"],
      });

    case "behavioral":
      return JSON.stringify({
        type: "behavioral_answer",
        situation: "[mock] Set the scene for the situation.",
        task: "[mock] State your specific responsibility.",
        action: "[mock] Describe the concrete steps you took.",
        result: "[mock] Quantify the outcome.",
        key_points: ["Own the outcome", "Be specific", "Quantify impact"],
        example_answer: "[mock] In my previous role, when ... I ... which resulted in ...",
      });

    case "meeting":
      return JSON.stringify({
        type: "meeting_notes",
        key_points: ["[mock] Point raised about " + (userText || "the topic")],
        decisions: [],
        action_items: [],
        risks: [],
        questions_to_ask: ["Can you clarify the timeline?"],
      });

    case "manual":
      return JSON.stringify({
        type: "manual",
        answer: `[mock AI — set OPENAI_API_KEY for real answers] Here's a concise take on: "${userText}".`,
        key_points: ["This is a mock response", "Configure OPENAI_API_KEY to get real answers"],
      });

    case "summary":
      return JSON.stringify({
        topics: ["General discussion"],
        questions_asked: [],
        strengths: ["Communicated clearly"],
        weaknesses: ["Could add more concrete examples"],
        action_items: ["Review core fundamentals for this role"],
        raw_summary: "[mock] Session summary unavailable without a configured LLM provider.",
      });

    default:
      return JSON.stringify({
        type: "technical_answer",
        title: "Suggested Answer",
        direct_answer: `[mock AI] ${userText || "Concise, speakable answer goes here."}`,
        key_points: ["Key point one", "Key point two"],
        example: "",
        tradeoffs: [],
        follow_up_questions: [],
      });
  }
}
