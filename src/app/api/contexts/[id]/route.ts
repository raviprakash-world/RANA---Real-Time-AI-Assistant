import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { apiError, notFound } from "@/lib/http/api-error";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const userId = await getCurrentUserId();
    const { count } = await prisma.pinnedContext.deleteMany({ where: { id, userId } });
    if (count === 0) return notFound("Pinned context not found");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(500, "Failed to delete pinned context", err);
  }
}
