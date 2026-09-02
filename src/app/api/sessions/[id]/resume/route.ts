import { NextRequest, NextResponse } from "next/server";
import { resumeSession, SessionNotFoundError } from "@/lib/services/session-service";
import { apiError, notFound } from "@/lib/http/api-error";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await resumeSession(id);
    return NextResponse.json({ session });
  } catch (err) {
    if (err instanceof SessionNotFoundError) return notFound("Session not found");
    return apiError(500, "Failed to resume session", err);
  }
}
