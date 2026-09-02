import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSession, listSessions } from "@/lib/services/session-service";
import { prisma } from "@/lib/db/prisma";
import { badRequest, apiError } from "@/lib/http/api-error";
import { checkRateLimit } from "@/lib/http/rate-limit";

const CreateSessionSchema = z.object({
  mode: z.enum(["INTERVIEW", "CODING", "SYSTEM_DESIGN", "MEETING", "CUSTOM"]),
  role: z.string().max(200).optional(),
  experience: z.string().max(100).optional(),
  context: z.string().max(4000).optional(),
  additionalInstructions: z.string().max(2000).optional(),
  uploadedContext: z
    .array(
      z.object({
        kind: z.enum(["RESUME", "JOB_DESCRIPTION", "OTHER"]),
        filename: z.string().max(255),
        text: z.string().max(20000),
      })
    )
    .max(5)
    .optional(),
});

export async function GET() {
  try {
    const sessions = await listSessions();
    return NextResponse.json({ sessions });
  } catch (err) {
    return apiError(500, "Failed to load sessions", err);
  }
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit("create-session", 30, 10 * 60_000)) {
    return apiError(429, "Too many sessions created recently — please wait a moment.");
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(`Invalid session payload: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
  }

  try {
    const session = await createSession(parsed.data);

    if (parsed.data.uploadedContext?.length) {
      await prisma.uploadedContext.createMany({
        data: parsed.data.uploadedContext.map((u) => ({
          sessionId: session.id,
          kind: u.kind,
          filename: u.filename,
          text: u.text,
        })),
      });
    }

    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    return apiError(500, "Failed to create session", err);
  }
}
