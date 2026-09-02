"use client";

import { useState } from "react";

// Em-relative (not fixed px) so these scale with the Font Size setting,
// which sets font-size once on the response container (see FloatingAssistant).
//
// `variant="primary"` is for the one section per response view that plays
// the reference design's "⭐ Answer" role (direct_answer, approach,
// architecture, etc.) — visually dominant, everything else (Tradeoffs,
// Follow-up, Example…) stays at the smaller default weight so the panel
// keeps a clear hierarchy instead of every section looking equally loud.
export function Section({
  label,
  children,
  variant = "default",
}: {
  label: string;
  children: React.ReactNode;
  variant?: "default" | "primary";
}) {
  if (!children) return null;
  if (variant === "primary") {
    return (
      <div>
        <div className="mb-1 flex items-center gap-1.5 text-[0.8em] font-semibold text-[var(--panel-fg)]">
          <span aria-hidden>⭐</span>
          {label}
        </div>
        <div className="text-[1.15em] font-medium leading-relaxed text-[var(--panel-fg)]">{children}</div>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-0.5 text-[0.72em] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">{label}</div>
      <div className="text-[1em] leading-snug text-[var(--panel-fg)]">{children}</div>
    </div>
  );
}

/** The 💬 Question block shown above the Answer in a response card (reference section 7). */
export function QuestionBlock({ text }: { text: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[0.8em] font-semibold text-[var(--panel-muted)]">
        <span aria-hidden>💬</span>
        Question
      </div>
      <div className="text-[1.05em] font-medium leading-snug text-[var(--panel-fg)]">{text}</div>
    </div>
  );
}

export function BulletList({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="list-disc space-y-0.5 pl-4 text-[1em] leading-snug text-[var(--panel-fg)]">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function CopyIconButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="focus-ring shrink-0 rounded border border-[var(--panel-border)] px-1.5 py-0.5 text-[10px] text-[var(--panel-muted)] hover:text-[var(--panel-fg)]"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/**
 * Timestamp + helpful/not-helpful footer (reference section 11). The
 * feedback buttons are a lightweight, local-only affordance — clicking one
 * just toggles which is highlighted for this viewer, nothing is sent
 * anywhere or persisted; there's no feedback-collection backend in this app
 * and adding one is out of scope for a UI redesign.
 */
export function ResponseFooter({
  receivedAt,
  feedback,
  onFeedback,
}: {
  receivedAt: number;
  feedback: "up" | "down" | null;
  onFeedback: (next: "up" | "down" | null) => void;
}) {
  const time = new Date(receivedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return (
    <div className="flex items-center gap-2 border-t border-[var(--panel-border)] pt-1.5 text-[0.72em] text-[var(--panel-muted-2)]">
      <span>Answer · {time}</span>
      <div className="ml-auto flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Helpful"
          aria-pressed={feedback === "up"}
          onClick={() => onFeedback(feedback === "up" ? null : "up")}
          className={`focus-ring rounded px-1 py-0.5 ${feedback === "up" ? "text-success" : "hover:text-[var(--panel-muted)]"}`}
        >
          👍
        </button>
        <button
          type="button"
          aria-label="Not helpful"
          aria-pressed={feedback === "down"}
          onClick={() => onFeedback(feedback === "down" ? null : "down")}
          className={`focus-ring rounded px-1 py-0.5 ${feedback === "down" ? "text-danger" : "hover:text-[var(--panel-muted)]"}`}
        >
          👎
        </button>
      </div>
    </div>
  );
}
