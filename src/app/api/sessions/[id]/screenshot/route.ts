import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { streamAndPersistResponse } from "@/lib/services/transcript-service";
import { sessionBus } from "@/lib/events/session-bus";
import { checkRateLimit } from "@/lib/http/rate-limit";
import { badRequest, apiError } from "@/lib/http/api-error";
import { logger, LogEvent } from "@/lib/observability/logger";

// Base64 data URL of a full-screen PNG easily runs a few MB; cap generously
// above that but well below anything that could be used to smuggle a large
// upload through this endpoint.
const MAX_DATA_URL_CHARS = 8 * 1024 * 1024;

const ScreenshotSchema = z.object({
  imageDataUrl: z
    .string()
    .startsWith("data:image/")
    .max(MAX_DATA_URL_CHARS),
  note: z.string().max(500).optional(),
});

/**
 * "Screenshot a coding problem" (spec: capture whatever's on screen during a
 * meeting/interview and get help with it). Same fire-and-return-202 shape as
 * the manual ask endpoint — the answer streams back over the session's SSE
 * connection and renders as a normal coding_answer response.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;

  if (!checkRateLimit(`screenshot:${sessionId}`, 10, 60_000)) {
    logger.warn(LogEvent.RateLimited, { sessionId, route: "screenshot" });
    return apiError(429, "Too many screenshot requests — please wait a moment.");
  }

  const body = await req.json().catch(() => null);
  const parsed = ScreenshotSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(`Invalid request: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
  }

  try {
    void streamAndPersistResponse(sessionId, {
      questionId: null,
      questionType: "CODING",
      questionText: "Screenshot: coding problem",
      manualInstruction: parsed.data.note,
      imageDataUrl: parsed.data.imageDataUrl,
    }).catch((err) => {
      logger.error(LogEvent.AIProviderFailure, {
        sessionId,
        stage: "screenshot",
        message: err instanceof Error ? err.message : "unknown error",
      });
      sessionBus.publish(sessionId, {
        type: "error",
        message: "Couldn't analyze the screenshot. Your transcript is still being captured.",
        scope: "ai",
      });
    });

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (err) {
    return apiError(500, "Failed to submit screenshot", err);
  }
}
