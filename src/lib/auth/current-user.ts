import { prisma } from "@/lib/db/prisma";

/**
 * Phase 1 runs as a single local user with no login UI. The schema is
 * multi-user-ready (User, Session.userId, etc.) so real auth can be added
 * later by replacing this function with a session/cookie lookup — nothing
 * else in the app needs to change.
 */
const LOCAL_USER_EMAIL = "local@real-time-assistant.app";

let cachedUserId: string | null = null;

export async function getCurrentUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const user = await prisma.user.upsert({
    where: { email: LOCAL_USER_EMAIL },
    update: {},
    create: {
      email: LOCAL_USER_EMAIL,
      name: "Local User",
      preference: { create: {} },
    },
  });

  cachedUserId = user.id;
  return user.id;
}
