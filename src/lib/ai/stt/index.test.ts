import { describe, expect, it } from "vitest";
import { getSTTProvider } from "./index";

describe("getSTTProvider", () => {
  it("falls back to the mock provider when OPENAI_API_KEY isn't set (as in this test env)", () => {
    const provider = getSTTProvider();
    expect(provider.isMock).toBe(true);
    expect(provider.id).toBe("mock");
  });
});
