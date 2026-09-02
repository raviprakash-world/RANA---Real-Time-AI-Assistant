"use client";

import { forwardRef } from "react";
import { AssistantStatus } from "@/components/StatusIndicator";

const DOT_COLOR: Record<AssistantStatus, string> = {
  idle: "bg-muted",
  listening: "bg-success",
  processing: "bg-info",
  thinking: "bg-info",
  ready: "bg-success",
  error: "bg-danger",
  paused: "bg-warning",
  disconnected: "bg-warning",
};

/**
 * The minimized state — as small as the assistant gets, per the "compact
 * mode" spec. Still always shows a status dot (never fully invisible while
 * capture is active — see the privacy/visibility principle in the spec).
 */
export const CompactIndicator = forwardRef<
  HTMLButtonElement,
  { status: AssistantStatus; responseCount: number; onExpand: () => void; style?: React.CSSProperties }
>(function CompactIndicator({ status, responseCount, onExpand, style }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onExpand}
      style={style}
      className="floating-panel floating-panel-enter focus-ring flex items-center gap-2 rounded-full border border-[var(--panel-border)] bg-black/70 px-3 py-2 text-xs font-medium text-[var(--panel-fg)] shadow-lg backdrop-blur-xl"
      aria-label={`Expand assistant (${responseCount} responses)`}
    >
      <span className="h-3 w-[3px] shrink-0 rounded-full bg-accent/70" aria-hidden />
      <span className={`h-2 w-2 rounded-full ${DOT_COLOR[status]} ${status === "thinking" || status === "listening" ? "pulse-dot" : ""}`} />
      AI{responseCount > 0 ? ` ${responseCount}` : ""}
    </button>
  );
});
