import { describe, expect, it } from "vitest";
import { generateResponse } from "./response-generator";
import { PromptContext } from "./prompts/types";

const baseContext: PromptContext = { mode: "CODING", role: "Software Engineer" };

async function collect(gen: AsyncGenerator<import("./response-generator").ResponseGenerationEvent>) {
  const events = [];
  for await (const event of gen) events.push(event);
  return events;
}

describe("generateResponse (against MockLLMProvider)", () => {
  it("streams partial text then a validated complete payload", async () => {
    const events = await collect(
      generateResponse({
        questionType: "CODING",
        questionText: "Reverse a linked list in place",
        context: baseContext,
      })
    );

    const partials = events.filter((e) => e.kind === "partial");
    const completes = events.filter((e) => e.kind === "complete");
    const errors = events.filter((e) => e.kind === "error");

    expect(partials.length).toBeGreaterThan(0);
    expect(errors).toHaveLength(0);
    expect(completes).toHaveLength(1);
    if (completes[0]?.kind === "complete") {
      expect(completes[0].payload.type).toBe("coding_answer");
    }
  });

  it("produces a manual-answer payload when a manual instruction is given", async () => {
    const events = await collect(
      generateResponse({
        questionType: "TECHNICAL",
        questionText: "",
        context: baseContext,
        manualInstruction: "Explain this more simply",
      })
    );
    const complete = events.find((e) => e.kind === "complete");
    expect(complete?.kind === "complete" && complete.payload.type).toBe("manual");
  });

  it("stops emitting once the signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const events = await collect(
      generateResponse({
        questionType: "TECHNICAL",
        questionText: "What is a closure?",
        context: baseContext,
        signal: controller.signal,
      })
    );
    // Aborted before any chunk is read — no complete/error should be emitted.
    expect(events.find((e) => e.kind === "complete")).toBeUndefined();
  });
});
