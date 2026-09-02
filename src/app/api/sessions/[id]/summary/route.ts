import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateSessionSummary } from "@/lib/services/summary-service";
import { apiError, notFound } from "@/lib/http/api-error";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const summary = await prisma.sessionSummary.findUnique({ where: { sessionId: id } });
    if (!summary) return notFound("Summary not generated yet");
    return NextResponse.json({ summary });
  } catch (err) {
    return apiError(500, "Failed to load summary", err);
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const summary = await generateSessionSummary(id);
    return NextResponse.json({ summary });
  } catch (err) {
    return apiError(500, "Failed to generate summary", err);
  }
}
