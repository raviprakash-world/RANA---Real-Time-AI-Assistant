import { describe, expect, it } from "vitest";
import { detectQuestion } from "./question-detector";
import { PromptContext } from "./prompts/types";

const baseContext: PromptContext = { mode: "INTERVIEW", role: "Full Stack Developer" };

describe("detectQuestion (against MockLLMProvider)", () => {
  it("classifies a system design question and returns it", async () => {
    const result = await detectQuestion(
      "How would you design a system to scale to a million users?",
      baseContext
    );
    expect(result).not.toBeNull();
    expect(result?.type).toBe("SYSTEM_DESIGN");
    expect(result?.confidence).toBeGreaterThan(0.5);
  });

  it("classifies a coding/algorithm question", async () => {
    const result = await detectQuestion("Can you write a function to reverse an array?", baseContext);
    expect(result?.type).toBe("CODING");
  });

  it("classifies a behavioral question", async () => {
    const result = await detectQuestion("Tell me about a time you had a conflict with a teammate.", baseContext);
    expect(result?.type).toBe("BEHAVIORAL");
  });
});
