import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { badRequest, apiError } from "@/lib/http/api-error";
import { checkRateLimit } from "@/lib/http/rate-limit";
import { logger } from "@/lib/observability/logger";

const AddContextSchema = z.object({
  kind: z.enum(["IDE", "BROWSER", "TERMINAL", "SCREEN", "OTHER"]),
  label: z.string().min(1).max(200),
  text: z.string().min(1).max(20000),
});

/**
 * Adds a mid-session context snapshot (pasted code, error output, a
 * relevant snippet from the screen) — the manually-driven counterpart to
 * the ContextProvider interface in lib/context/. It's stored the same way
 * as pre-session resume/JD uploads (UploadedContext) and picked up
 * automatically by context-engine.buildPromptContext on the next AI call.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;

  if (!checkRateLimit(`context:${sessionId}`, 20, 60_000)) {
    return apiError(429, "Too many context updates — please wait a moment.");
  }

  const body = await req.json().catch(() => null);
  const parsed = AddContextSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(`Invalid context payload: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
  }

  try {
    const entry = await prisma.uploadedContext.create({
      data: {
        sessionId,
        kind: parsed.data.kind,
        filename: parsed.data.label,
        text: parsed.data.text,
      },
    });
    logger.info("context.added", { sessionId, kind: parsed.data.kind, chars: parsed.data.text.length });
    return NextResponse.json({ context: entry }, { status: 201 });
  } catch (err) {
    return apiError(500, "Failed to add context", err);
  }
}
