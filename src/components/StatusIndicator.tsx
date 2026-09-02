export type AssistantStatus =
  | "idle"
  | "listening"
  | "processing"
  | "thinking"
  | "ready"
  | "error"
  | "paused"
  | "disconnected";

const CONFIG: Record<AssistantStatus, { label: string; color: string; symbol: string; pulse?: boolean }> = {
  idle: { label: "Idle", color: "text-muted", symbol: "○" },
  listening: { label: "Listening", color: "text-success", symbol: "●", pulse: true },
  processing: { label: "Processing", color: "text-info", symbol: "◌", pulse: true },
  thinking: { label: "Thinking", color: "text-info", symbol: "◌", pulse: true },
  ready: { label: "Answer ready", color: "text-success", symbol: "✓" },
  error: { label: "Error", color: "text-danger", symbol: "!" },
  paused: { label: "Paused", color: "text-warning", symbol: "Ⅱ" },
  disconnected: { label: "Disconnected", color: "text-warning", symbol: "×" },
};

export function StatusIndicator({ status }: { status: AssistantStatus }) {
  const cfg = CONFIG[status];
  return (
    <span
      role="status"
      aria-label={cfg.label}
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}
    >
      <span className={cfg.pulse ? "pulse-dot" : ""}>{cfg.symbol}</span>
      {cfg.label}
    </span>
  );
}
