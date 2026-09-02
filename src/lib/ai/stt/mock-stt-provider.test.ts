import { describe, expect, it } from "vitest";
import { MockSTTProvider } from "./mock-stt-provider";

describe("MockSTTProvider", () => {
  it("never fabricates transcript text", async () => {
    const provider = new MockSTTProvider();
    const result = await provider.transcribe(Buffer.from("fake audio bytes"), "audio/webm");
    expect(result).toBe("");
  });

  it("is flagged as a mock", () => {
    const provider = new MockSTTProvider();
    expect(provider.isMock).toBe(true);
    expect(provider.id).toBe("mock");
  });
});
