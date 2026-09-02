import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ingestTranscriptChunk } from "@/lib/services/transcript-service";
import { checkRateLimit } from "@/lib/http/rate-limit";
import { badRequest, apiError } from "@/lib/http/api-error";
import { logger, LogEvent } from "@/lib/observability/logger";

const ChunkSchema = z.object({
  speaker: z.enum(["INTERVIEWER", "USER", "UNKNOWN"]).default("UNKNOWN"),
  text: z.string().min(1).max(4000),
  isFinal: z.boolean(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;

  if (!checkRateLimit(`transcript:${sessionId}`, 60, 10_000)) {
    logger.warn(LogEvent.RateLimited, { sessionId, route: "transcript" });
    return apiError(429, "Too many transcript updates — slow down.");
  }

  const body = await req.json().catch(() => null);
  const parsed = ChunkSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(`Invalid transcript chunk: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
  }

  try {
    const result = await ingestTranscriptChunk({ sessionId, ...parsed.data });
    return NextResponse.json(result);
  } catch (err) {
    return apiError(500, "Failed to ingest transcript chunk", err);
  }
}
