import { NextRequest, NextResponse } from "next/server";
import { endSession, SessionNotFoundError } from "@/lib/services/session-service";
import { generateSessionSummary } from "@/lib/services/summary-service";
import { apiError, notFound } from "@/lib/http/api-error";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await endSession(id);
    const summary = await generateSessionSummary(id);
    return NextResponse.json({ session, summary });
  } catch (err) {
    if (err instanceof SessionNotFoundError) return notFound("Session not found");
    return apiError(500, "Failed to end session", err);
  }
}
