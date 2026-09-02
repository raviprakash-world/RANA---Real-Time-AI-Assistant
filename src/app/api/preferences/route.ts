import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { apiError, badRequest } from "@/lib/http/api-error";

const PreferenceUpdateSchema = z.object({
  autoAnswer: z.boolean().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().min(100).max(2000).optional(),
  language: z.string().min(2).max(20).optional(),
  retentionDays: z.number().int().min(1).max(365).optional(),
  // Floating assistant panel state — merged (not replaced) into the stored
  // JSON so a partial update (e.g. just a drag-end position) never clobbers
  // the rest (e.g. opacity/theme) set elsewhere.
  floatingUi: z.record(z.string(), z.unknown()).optional(),
});

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const preference = await prisma.userPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return NextResponse.json({ preference });
  } catch (err) {
    return apiError(500, "Failed to load preferences", err);
  }
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = PreferenceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(`Invalid preferences: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
  }

  try {
    const userId = await getCurrentUserId();
    const { floatingUi, ...rest } = parsed.data;

    let data: Record<string, unknown> = rest;
    if (floatingUi) {
      const existing = await prisma.userPreference.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });
      const merged = { ...(existing.floatingUi as Record<string, unknown>), ...floatingUi };
      data = { ...rest, floatingUi: merged };
    }

    const preference = await prisma.userPreference.update({
      where: { userId },
      data,
    });
    return NextResponse.json({ preference });
  } catch (err) {
    return apiError(500, "Failed to update preferences", err);
  }
}
