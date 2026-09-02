import { prisma } from "@/lib/db/prisma";
import { getLLMProvider } from "@/lib/ai/llm";
import { PromptContext } from "@/lib/ai/prompts/types";
import { contextProviderRegistry } from "@/lib/context/registry";

const RECENT_SEGMENT_WINDOW = 15;
const COMPACT_EVERY_N_SEGMENTS = 12;
const UPLOADED_CONTEXT_CHAR_LIMIT = 1800;

/**
 * Session-level rolling context: instead of sending the entire transcript
 * to the model on every call, we keep a short-term window of recent final
 * segments plus a periodically-refreshed rolling summary of everything
 * older. This bounds token usage regardless of session length (see
 * MASTER BUILD PROMPT section 10).
 */
export async function buildPromptContext(sessionId: string): Promise<PromptContext> {
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      uploadedContext: true,
    },
  });

  const recentSegments = await prisma.transcriptSegment.findMany({
    where: { sessionId, isFinal: true },
    orderBy: { createdAt: "desc" },
    take: RECENT_SEGMENT_WINDOW,
  });
  recentSegments.reverse();

  // Live automated context providers (IDE/browser/screen — none registered
  // by default today, see lib/context/) are merged in alongside whatever
  // the user pasted/uploaded, so the AI layer never needs to know which
  // source a given snippet came from.
  const liveSnapshots = await contextProviderRegistry.captureAll();
  const liveExcerpt = liveSnapshots.map((s) => `[${s.kind}] ${s.label}\n${s.content}`).join("\n\n");

  const storedExcerpt = session.uploadedContext.map((u) => `[${u.kind}] ${u.filename}\n${u.text}`).join("\n\n");

  const uploadedExcerpt = [storedExcerpt, liveExcerpt].filter(Boolean).join("\n\n").slice(0, UPLOADED_CONTEXT_CHAR_LIMIT);

  return {
    mode: session.mode,
    role: session.role,
    experience: session.experience,
    contextNote: session.context,
    additionalInstructions: session.additionalInstructions,
    detectedTechnologies: (session.detectedTechnologies as string[]) ?? [],
    uploadedContextExcerpt: uploadedExcerpt,
    rollingSummary: session.rollingSummary ?? "",
    recentTranscript: recentSegments.map((s) => `${s.speaker}: ${s.text}`).join("\n"),
  };
}

/**
 * Called after each final transcript segment is stored. Periodically
 * condenses the transcript preceding the "recent window" into a rolling
 * summary, so the recent-window + rolling-summary strategy stays bounded.
 */
export async function maybeCompactContext(sessionId: string): Promise<void> {
  const finalCount = await prisma.transcriptSegment.count({
    where: { sessionId, isFinal: true },
  });

  if (finalCount === 0 || finalCount % COMPACT_EVERY_N_SEGMENTS !== 0) return;

  const olderSegments = await prisma.transcriptSegment.findMany({
    where: { sessionId, isFinal: true },
    orderBy: { createdAt: "asc" },
    take: finalCount - RECENT_SEGMENT_WINDOW,
  });
  if (olderSegments.length === 0) return;

  const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
  const provider = getLLMProvider();

  const text = olderSegments.map((s) => `${s.speaker}: ${s.text}`).join("\n");
  const raw = await provider.generate(
    [
      {
        role: "system",
        content:
          "You condense conversation transcripts into a short factual running summary for another AI to use as context. Be terse.",
      },
      {
        role: "user",
        content: `Existing summary:\n${session.rollingSummary || "(none yet)"}\n\nNew transcript to fold in:\n${text}\n\nReturn ONLY the updated running summary as plain text, under 150 words.`,
      },
    ],
    { temperature: 0.2, maxTokens: 300 }
  );

  await prisma.session.update({
    where: { id: sessionId },
    data: { rollingSummary: raw.trim() },
  });
}

/** Extracts likely technology keywords from text to prioritize in prompts (section 16). */
const KNOWN_TECHNOLOGIES = [
  "React",
  "Next.js",
  "Node.js",
  "TypeScript",
  "JavaScript",
  "Python",
  "Java",
  "Go",
  "Rust",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "AWS",
  "GCP",
  "Azure",
  "Docker",
  "Kubernetes",
  "GraphQL",
  "REST",
  "Kafka",
  "RabbitMQ",
  "Microservices",
  "gRPC",
  "SQL",
];

export function extractTechnologies(text: string): string[] {
  const found = new Set<string>();
  for (const tech of KNOWN_TECHNOLOGIES) {
    const pattern = new RegExp(`\\b${tech.replace(".", "\\.")}\\b`, "i");
    if (pattern.test(text)) found.add(tech);
  }
  return [...found];
}

export async function mergeDetectedTechnologies(sessionId: string, text: string): Promise<void> {
  const found = extractTechnologies(text);
  if (found.length === 0) return;

  const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
  const existing = new Set((session.detectedTechnologies as string[]) ?? []);
  found.forEach((t) => existing.add(t));

  await prisma.session.update({
    where: { id: sessionId },
    data: { detectedTechnologies: [...existing] },
  });
}
