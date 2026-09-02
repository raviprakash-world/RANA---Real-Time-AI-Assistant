import { NextResponse } from "next/server";

/**
 * Uniform error envelope for API routes. Never leaks stack traces or raw
 * provider errors to the client (section 23) — logs the real error
 * server-side and returns a short, human-readable message.
 */
export function apiError(status: number, message: string, err?: unknown) {
  if (err) console.error(`[api] ${message}`, err);
  return NextResponse.json({ error: message }, { status });
}

export function badRequest(message: string) {
  return apiError(400, message);
}

export function notFound(message = "Not found") {
  return apiError(404, message);
}
