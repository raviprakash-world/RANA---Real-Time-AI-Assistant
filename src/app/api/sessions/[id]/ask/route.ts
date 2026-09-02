import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { streamAndPersistResponse } from "@/lib/services/transcript-service";
import { sessionBus } from "@/lib/events/session-bus";
import { checkRateLimit } from "@/lib/http/rate-limit";
import { badRequest, apiError } from "@/lib/http/api-error";
import { logger, LogEvent } from "@/lib/observability/logger";

const AskSchema = z.object({
  instruction: z.string().min(1).max(2000),
});

/**
 * Manual "Ask AI anything" endpoint (section 8). Fires the generation and
 * returns immediately (202) — the actual streamed answer arrives over the
 * session's SSE stream (ai.thinking / ai.response.partial / .complete),
 * same as auto-detected questions.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;

  if (!checkRateLimit(`ask:${sessionId}`, 20, 60_000)) {
    logger.warn(LogEvent.RateLimited, { sessionId, route: "ask" });
    return apiError(429, "Too many AI requests — please wait a moment.");
  }

  const body = await req.json().catch(() => null);
  const parsed = AskSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(`Invalid request: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
  }

  try {
    void streamAndPersistResponse(sessionId, {
      questionId: null,
      questionType: "TECHNICAL",
      questionText: parsed.data.instruction,
      manualInstruction: parsed.data.instruction,
    }).catch((err) => {
      logger.error(LogEvent.AIProviderFailure, {
        sessionId,
        stage: "manual-ask",
        message: err instanceof Error ? err.message : "unknown error",
      });
      sessionBus.publish(sessionId, {
        type: "error",
        message: "AI response couldn't be generated. Your transcript is still being captured.",
        scope: "ai",
      });
    });

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (err) {
    return apiError(500, "Failed to submit request", err);
  }
}
