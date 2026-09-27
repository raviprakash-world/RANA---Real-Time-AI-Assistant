import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { badRequest, apiError } from "@/lib/http/api-error";
import { checkRateLimit } from "@/lib/http/rate-limit";

const PersonaSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().max(100).optional(),
  experience: z.string().max(50).optional(),
  additionalInstructions: z.string().max(2000).optional(),
});

/** Saved role/experience/instructions presets for /sessions/new (spec: "Personas" — e.g. "Frontend Developer Mode" vs "Backend Developer Mode"). */
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const personas = await prisma.persona.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ personas });
  } catch (err) {
    return apiError(500, "Failed to load personas", err);
  }
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!checkRateLimit(`persona:${userId}`, 20, 60_000)) {
    return apiError(429, "Too many requests — please wait a moment.");
  }

  const body = await req.json().catch(() => null);
  const parsed = PersonaSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(`Invalid persona: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
  }

  try {
    const persona = await prisma.persona.create({
      data: { userId, ...parsed.data },
    });
    return NextResponse.json({ persona }, { status: 201 });
  } catch (err) {
    return apiError(500, "Failed to save persona", err);
  }
}
