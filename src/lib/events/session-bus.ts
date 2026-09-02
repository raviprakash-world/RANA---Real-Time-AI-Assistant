import { EventEmitter } from "events";
import { AIResponsePayload, QuestionType } from "@/lib/ai/schemas";

export type SessionEvent =
  | { type: "transcript.partial"; segmentId: string; speaker: string; text: string }
  | { type: "transcript.final"; segmentId: string; speaker: string; text: string; startMs: number }
  | { type: "speaker.detected"; speaker: string }
  | { type: "question.detected"; questionId: string; questionType: QuestionType; confidence: number; question: string }
  | { type: "ai.thinking"; questionId: string | null }
  | { type: "ai.response.partial"; questionId: string | null; textSoFar: string }
  | { type: "ai.response.complete"; questionId: string | null; responseId: string; payload: AIResponsePayload }
  | { type: "session.status"; status: "ACTIVE" | "PAUSED" | "ENDED" }
  | { type: "history.cleared" }
  | { type: "error"; message: string; scope?: "transcript" | "ai" | "connection" };

/**
 * Per-session in-memory pub/sub used to fan out real-time events to SSE
 * subscribers (see /api/sessions/[id]/events). This is intentionally a
 * single-process implementation — swapping in Redis pub/sub for multi
 * instance deployments would only touch this file.
 */
class SessionBus {
  private emitters = new Map<string, EventEmitter>();

  private getEmitter(sessionId: string): EventEmitter {
    let emitter = this.emitters.get(sessionId);
    if (!emitter) {
      emitter = new EventEmitter();
      emitter.setMaxListeners(20);
      this.emitters.set(sessionId, emitter);
    }
    return emitter;
  }

  publish(sessionId: string, event: SessionEvent): void {
    this.getEmitter(sessionId).emit("event", event);
  }

  subscribe(sessionId: string, listener: (event: SessionEvent) => void): () => void {
    const emitter = this.getEmitter(sessionId);
    emitter.on("event", listener);
    return () => {
      emitter.off("event", listener);
      if (emitter.listenerCount("event") === 0) {
        this.emitters.delete(sessionId);
      }
    };
  }
}

const globalForBus = globalThis as unknown as { sessionBus?: SessionBus };
export const sessionBus = globalForBus.sessionBus ?? new SessionBus();
if (process.env.NODE_ENV !== "production") {
  globalForBus.sessionBus = sessionBus;
}
