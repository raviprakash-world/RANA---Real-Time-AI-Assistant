import { describe, expect, it } from "vitest";
import { extractTechnologies } from "./context-engine";

describe("extractTechnologies", () => {
  it("finds known technologies mentioned in text", () => {
    const text = "We use React on the frontend and PostgreSQL with Redis caching, deployed on AWS.";
    const found = extractTechnologies(text);
    expect(found).toEqual(expect.arrayContaining(["React", "PostgreSQL", "Redis", "AWS"]));
  });

  it("is case-insensitive but returns the canonical casing", () => {
    const found = extractTechnologies("we use react and typescript daily");
    expect(found).toContain("React");
    expect(found).toContain("TypeScript");
  });

  it("does not false-positive on unrelated words", () => {
    const found = extractTechnologies("We had a great conversation about the weather and lunch plans.");
    expect(found).toEqual([]);
  });

  it("matches whole words only (no partial substring matches)", () => {
    // "Golang" should not trigger a match on "Go" as a substring
    const found = extractTechnologies("I've heard of Golang but haven't used it.");
    expect(found).not.toContain("Go");
  });
});
