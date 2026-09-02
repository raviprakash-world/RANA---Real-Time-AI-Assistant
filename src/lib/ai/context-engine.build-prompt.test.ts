import { describe, expect, it, vi } from "vitest";

const { session } = vi.hoisted(() => ({
  session: {
    id: "s1",
    mode: "CODING" as const,
    role: "Software Engineer",
    experience: "Mid-Level",
    context: null,
    additionalInstructions: null,
    rollingSummary: "",
    detectedTechnologies: [] as string[],
    uploadedContext: [
      { id: "u1", kind: "IDE", filename: "App.tsx", text: "function reverseList(head) { /* pasted code */ }" },
    ],
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    session: {
      findUniqueOrThrow: vi.fn(async () => session),
    },
    transcriptSegment: {
      findMany: vi.fn(async () => []),
    },
  },
}));

const { buildPromptContext } = await import("./context-engine");
const { contextProviderRegistry } = await import("@/lib/context/registry");
const { MockScreenProvider } = await import("@/lib/context/providers/mock-screen-provider");

describe("buildPromptContext", () => {
  it("includes stored (pasted/uploaded) context in the excerpt sent to the LLM", async () => {
    const ctx = await buildPromptContext("s1");
    expect(ctx.uploadedContextExcerpt).toContain("App.tsx");
    expect(ctx.uploadedContextExcerpt).toContain("reverseList");
  });

  it("also merges in live snapshots from registered ContextProviders", async () => {
    const provider = new MockScreenProvider("SCREEN");
    provider.setSnapshot("Terminal shows: TypeError at line 42", "Terminal");
    contextProviderRegistry.register(provider);

    try {
      const ctx = await buildPromptContext("s1");
      expect(ctx.uploadedContextExcerpt).toContain("App.tsx"); // stored context still present
      expect(ctx.uploadedContextExcerpt).toContain("TypeError at line 42"); // live provider merged in
    } finally {
      contextProviderRegistry.unregister(provider.id);
    }
  });
});
