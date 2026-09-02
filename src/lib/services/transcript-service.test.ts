import { afterEach, describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted above imports, so any state they close over
// must be created via vi.hoisted.
const { state, publishedEvents } = vi.hoisted(() => {
  return {
    state: {
      session: {
        id: "s1",
        mode: "CODING" as const,
        role: "Software Engineer",
        experience: "Mid-Level",
        context: null,
        additionalInstructions: null,
        rollingSummary: "",
        detectedTechnologies: [] as string[],
        status: "ACTIVE" as const,
        startedAt: new Date(),
        userId: "u1",
      },
      segments: [] as { id: string; sessionId: string; speaker: string; text: string; isFinal: boolean; startMs: number; createdAt: Date }[],
      questions: [] as { id: string; sessionId: string; type: string; confidence: number; questionText: string }[],
      responses: [] as { id: string; sessionId: string; questionId: string | null; type: string; payload: unknown }[],
    },
    publishedEvents: [] as { type: string; [key: string]: unknown }[],
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    transcriptSegment: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const seg = { id: `seg${state.segments.length + 1}`, createdAt: new Date(), ...data } as (typeof state.segments)[number];
        state.segments.push(seg);
        return seg;
      }),
      findMany: vi.fn(async () => state.segments.filter((s) => s.isFinal)),
      count: vi.fn(async () => state.segments.filter((s) => s.isFinal).length),
    },
    session: {
      findUnique: vi.fn(async () => ({ ...state.session, user: { preference: { autoAnswer: true } } })),
      findUniqueOrThrow: vi.fn(async () => ({ ...state.session, uploadedContext: [] })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(state.session, data);
        return state.session;
      }),
    },
    question: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const q = { id: `q${state.questions.length + 1}`, ...data } as (typeof state.questions)[number];
        state.questions.push(q);
        return q;
      }),
    },
    aIResponse: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const r = { id: `r${state.responses.length + 1}`, ...data } as (typeof state.responses)[number];
        state.responses.push(r);
        return r;
      }),
    },
  },
}));

vi.mock("@/lib/events/session-bus", () => ({
  sessionBus: {
    publish: vi.fn((_sessionId: string, event: { type: string; [key: string]: unknown }) => {
      publishedEvents.push(event);
    }),
    subscribe: vi.fn(() => () => {}),
  },
}));

const { ingestTranscriptChunk, clearRuntime } = await import("./transcript-service");
const { Speaker } = await import("@prisma/client");

async function waitUntil(predicate: () => boolean, timeoutMs = 3000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitUntil timed out");
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe("transcript-service integration (mocked DB, real MockLLMProvider)", () => {
  afterEach(() => {
    clearRuntime("s1");
    publishedEvents.length = 0;
  });

  it("ingests a final segment ending in '?' and produces a question + AI response", async () => {
    await ingestTranscriptChunk({
      sessionId: "s1",
      speaker: Speaker.UNKNOWN,
      text: "How would you design a rate limiter for an API gateway?",
      isFinal: true,
      startMs: 0,
    });

    await waitUntil(() => publishedEvents.some((e) => e.type === "ai.response.complete"));

    const detected = publishedEvents.find((e) => e.type === "question.detected");
    expect(detected).toBeDefined();
    expect(detected?.questionType).toBe("SYSTEM_DESIGN");

    const complete = publishedEvents.find((e) => e.type === "ai.response.complete");
    expect(complete).toBeDefined();
    expect((complete?.payload as { type: string }).type).toBe("system_design_answer");

    expect(state.questions).toHaveLength(1);
    expect(state.responses).toHaveLength(1);
  });

  it("does not trigger AI assistance for the user's own speech", async () => {
    await ingestTranscriptChunk({
      sessionId: "s1",
      speaker: Speaker.USER,
      text: "I would use a token bucket algorithm here?",
      isFinal: true,
      startMs: 0,
    });

    // give any (incorrect) async work a chance to run, then assert nothing fired
    await new Promise((r) => setTimeout(r, 300));
    expect(publishedEvents.some((e) => e.type === "question.detected")).toBe(false);
  });

  it("only broadcasts partial (non-final) chunks, never persists them", async () => {
    const result = await ingestTranscriptChunk({
      sessionId: "s1",
      speaker: Speaker.UNKNOWN,
      text: "so how would you",
      isFinal: false,
      startMs: 0,
    });
    expect(result.persisted).toBe(false);
    expect(publishedEvents.find((e) => e.type === "transcript.partial")).toBeDefined();
  });
});
