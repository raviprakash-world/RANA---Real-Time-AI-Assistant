import { describe, expect, it } from "vitest";
import {
  AIResponsePayloadSchema,
  QuestionDetectionSchema,
  parseAndValidate,
} from "./schemas";

describe("parseAndValidate", () => {
  it("parses and validates well-formed JSON", () => {
    const raw = JSON.stringify({ type: "TECHNICAL", confidence: 0.9, question: "What is a closure?" });
    const result = parseAndValidate(raw, QuestionDetectionSchema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.type).toBe("TECHNICAL");
      expect(result.data.confidence).toBe(0.9);
    }
  });

  it("strips markdown code fences before parsing", () => {
    const raw = "```json\n" + JSON.stringify({ type: "CODING", confidence: 0.8, question: "Reverse a list" }) + "\n```";
    const result = parseAndValidate(raw, QuestionDetectionSchema);
    expect(result.ok).toBe(true);
  });

  it("rejects invalid JSON", () => {
    const result = parseAndValidate("not json at all", QuestionDetectionSchema);
    expect(result.ok).toBe(false);
  });

  it("rejects JSON that doesn't match the schema", () => {
    const raw = JSON.stringify({ type: "NOT_A_REAL_TYPE", confidence: 2, question: "x" });
    const result = parseAndValidate(raw, QuestionDetectionSchema);
    expect(result.ok).toBe(false);
  });

  it("discriminates AIResponsePayload by type", () => {
    const coding = JSON.stringify({
      type: "coding_answer",
      problem: "Reverse a linked list",
      approach: "Iterative pointer reversal",
      complexity: { time: "O(n)", space: "O(1)" },
      code: "function reverse(head) { /* ... */ }",
      edge_cases: ["empty list"],
    });
    const result = parseAndValidate(coding, AIResponsePayloadSchema);
    expect(result.ok).toBe(true);
    if (result.ok && result.data.type === "coding_answer") {
      expect(result.data.complexity.time).toBe("O(n)");
      // defaults fill in optional fields
      expect(result.data.explanation).toBe("");
    }
  });

  it("rejects a payload whose type doesn't match any known shape", () => {
    const raw = JSON.stringify({ type: "not_a_type", foo: "bar" });
    const result = parseAndValidate(raw, AIResponsePayloadSchema);
    expect(result.ok).toBe(false);
  });
});
