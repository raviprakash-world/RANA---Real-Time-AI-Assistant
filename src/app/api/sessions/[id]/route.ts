import { NextRequest, NextResponse } from "next/server";
import { getSessionDetail, deleteSession, SessionNotFoundError } from "@/lib/services/session-service";
import { apiError, notFound } from "@/lib/http/api-error";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getSessionDetail(id);
    if (!session) return notFound("Session not found");
    return NextResponse.json({ session });
  } catch (err) {
    return apiError(500, "Failed to load session", err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await deleteSession(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SessionNotFoundError) return notFound("Session not found");
    return apiError(500, "Failed to delete session", err);
  }
}
