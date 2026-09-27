import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { badRequest, apiError } from "@/lib/http/api-error";
import { checkRateLimit } from "@/lib/http/rate-limit";

const PinnedContextSchema = z.object({
  label: z.string().min(1).max(200),
  kind: z.enum(["RESUME", "JOB_DESCRIPTION", "IDE", "BROWSER", "TERMINAL", "SCREEN", "OTHER"]).default("OTHER"),
  text: z.string().min(1).max(20000),
});

/** User-level saved context library (spec: "Pinned Contexts") — reusable across sessions, unlike per-session UploadedContext. */
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const contexts = await prisma.pinnedContext.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ contexts });
  } catch (err) {
    return apiError(500, "Failed to load pinned contexts", err);
  }
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!checkRateLimit(`pinned-context:${userId}`, 20, 60_000)) {
    return apiError(429, "Too many requests — please wait a moment.");
  }

  const body = await req.json().catch(() => null);
  const parsed = PinnedContextSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(`Invalid context: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
  }

  try {
    const context = await prisma.pinnedContext.create({
      data: { userId, ...parsed.data },
    });
    return NextResponse.json({ context }, { status: 201 });
  } catch (err) {
    return apiError(500, "Failed to save pinned context", err);
  }
}
