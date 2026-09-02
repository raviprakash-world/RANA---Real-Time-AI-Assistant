import { NextRequest, NextResponse } from "next/server";
import { clearSessionHistory, SessionNotFoundError } from "@/lib/services/session-service";
import { apiError, notFound } from "@/lib/http/api-error";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await clearSessionHistory(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SessionNotFoundError) return notFound("Session not found");
    return apiError(500, "Failed to clear history", err);
  }
}
