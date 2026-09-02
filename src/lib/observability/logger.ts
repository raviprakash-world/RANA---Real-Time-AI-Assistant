/**
 * Minimal structured logger. Emits single-line JSON so logs are greppable
 * and ingestible by any log pipeline. Deliberately takes a closed set of
 * fields per call site rather than a free-form message + arbitrary payload,
 * to make it harder to accidentally log raw transcript/prompt content
 * (section 24: "no sensitive information in logs").
 */
type LogFields = Record<string, string | number | boolean | null | undefined>;

function emit(level: "info" | "warn" | "error", event: string, fields?: LogFields) {
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const serialized = JSON.stringify(line);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.log(serialized);
}

export const logger = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};

/** Standard event names, kept centralized so call sites stay consistent. */
export const LogEvent = {
  SessionCreated: "session.created",
  SessionEnded: "session.ended",
  SessionDeleted: "session.deleted",
  HistoryCleared: "history.cleared",
  TranscriptIngested: "transcript.ingested",
  QuestionDetected: "question.detected",
  AIResponseGenerated: "ai.response.generated",
  AIProviderFailure: "ai.provider.failure",
  AIResponseParseFailed: "ai.response.parse_failed",
  SummaryGenerated: "summary.generated",
  SSEConnected: "sse.connected",
  SSEDisconnected: "sse.disconnected",
  RateLimited: "rate_limited",
} as const;
