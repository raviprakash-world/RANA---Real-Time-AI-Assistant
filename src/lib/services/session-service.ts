import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { sessionBus } from "@/lib/events/session-bus";
import { clearRuntime } from "@/lib/services/transcript-service";
import { SessionMode } from "@prisma/client";
import { logger, LogEvent } from "@/lib/observability/logger";

export interface CreateSessionInput {
  mode: SessionMode;
  role?: string;
  experience?: string;
  context?: string;
  additionalInstructions?: string;
}

export async function createSession(input: CreateSessionInput) {
  const userId = await getCurrentUserId();
  const session = await prisma.session.create({
    data: {
      userId,
      mode: input.mode,
      role: input.role,
      experience: input.experience,
      context: input.context,
      additionalInstructions: input.additionalInstructions,
    },
  });
  logger.info(LogEvent.SessionCreated, { sessionId: session.id, mode: session.mode });
  return session;
}

export async function listSessions() {
  const userId = await getCurrentUserId();
  return prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { questions: true, transcriptSegments: true } },
      summary: true,
    },
  });
}

export class SessionNotFoundError extends Error {
  constructor() {
    super("Session not found");
  }
}

/**
 * Every mutating/read-one operation below goes through this ownership check
 * first. It's a no-op today (there's only one local user), but it means the
 * moment real multi-user auth lands, one user can never read/modify
 * another's session data by guessing an id — the authorization boundary
 * is already in place (section 24).
 */
async function assertOwnedSession(sessionId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const owned = await prisma.session.findFirst({ where: { id: sessionId, userId }, select: { id: true } });
  if (!owned) throw new SessionNotFoundError();
}

export async function getSessionDetail(sessionId: string) {
  const userId = await getCurrentUserId();
  return prisma.session.findFirst({
    where: { id: sessionId, userId },
    include: {
      transcriptSegments: { orderBy: { createdAt: "asc" } },
      questions: { orderBy: { createdAt: "asc" }, include: { responses: true } },
      aiResponses: { orderBy: { createdAt: "asc" } },
      summary: true,
      uploadedContext: true,
    },
  });
}

export async function pauseSession(sessionId: string) {
  await assertOwnedSession(sessionId);
  const session = await prisma.session.update({
    where: { id: sessionId },
    data: { status: "PAUSED" },
  });
  sessionBus.publish(sessionId, { type: "session.status", status: "PAUSED" });
  return session;
}

export async function resumeSession(sessionId: string) {
  await assertOwnedSession(sessionId);
  const session = await prisma.session.update({
    where: { id: sessionId },
    data: { status: "ACTIVE" },
  });
  sessionBus.publish(sessionId, { type: "session.status", status: "ACTIVE" });
  return session;
}

export async function endSession(sessionId: string) {
  await assertOwnedSession(sessionId);
  const existing = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
  const durationSec = Math.round((Date.now() - existing.startedAt.getTime()) / 1000);

  const session = await prisma.session.update({
    where: { id: sessionId },
    data: { status: "ENDED", endedAt: new Date(), durationSec },
  });
  clearRuntime(sessionId);
  sessionBus.publish(sessionId, { type: "session.status", status: "ENDED" });
  logger.info(LogEvent.SessionEnded, { sessionId, durationSec });
  return session;
}

/**
 * Wipes the accumulated Q&A feed (detected questions + AI responses) for a
 * session without ending it — the in-panel "Clear history" action. Leaves
 * the transcript and rolling AI context/summary untouched: this clears what
 * the viewer sees, not the assistant's mid-session memory.
 */
export async function clearSessionHistory(sessionId: string) {
  await assertOwnedSession(sessionId);
  await prisma.$transaction([
    prisma.aIResponse.deleteMany({ where: { sessionId } }),
    prisma.question.deleteMany({ where: { sessionId } }),
  ]);
  sessionBus.publish(sessionId, { type: "history.cleared" });
  logger.info(LogEvent.HistoryCleared, { sessionId });
}

export async function deleteSession(sessionId: string) {
  await assertOwnedSession(sessionId);
  clearRuntime(sessionId);
  await prisma.session.delete({ where: { id: sessionId } });
  logger.info(LogEvent.SessionDeleted, { sessionId });
}
