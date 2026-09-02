import { NextRequest } from "next/server";
import { sessionBus, SessionEvent } from "@/lib/events/session-bus";
import { logger, LogEvent } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

function toSseFrame(event: SessionEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * Server-Sent Events stream for one session. Emits the event protocol
 * described in the master spec (transcript.partial/final, question.detected,
 * ai.thinking, ai.response.partial/complete, session.status, error).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const send = (event: SessionEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(toSseFrame(event)));
        } catch {
          closed = true;
        }
      };

      // Initial hello so the client can confirm the stream is live.
      controller.enqueue(encoder.encode(`event: connected\ndata: {"sessionId":"${sessionId}"}\n\n`));
      logger.info(LogEvent.SSEConnected, { sessionId });

      const unsubscribe = sessionBus.subscribe(sessionId, send);

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          closed = true;
        }
      }, 20000);

      const cleanup = () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        logger.info(LogEvent.SSEDisconnected, { sessionId });
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      _req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
