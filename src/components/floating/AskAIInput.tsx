"use client";

import { forwardRef, useState } from "react";

export const AskAIInput = forwardRef<HTMLTextAreaElement, { onAsk: (instruction: string) => void; disabled?: boolean }>(
  function AskAIInput({ onAsk, disabled }, ref) {
    const [value, setValue] = useState("");
    const [expanded, setExpanded] = useState(false);

    function submit() {
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      onAsk(trimmed);
      setValue("");
    }

    return (
      <div className="shrink-0 border-t border-[var(--panel-border)] p-2">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setExpanded(true)}
          onBlur={() => !value && setExpanded(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          placeholder="Ask AI…"
          aria-label="Ask AI anything"
          disabled={disabled}
          rows={expanded ? 3 : 1}
          className="focus-ring w-full resize-none rounded-md border border-[var(--panel-border)] bg-[var(--panel-surface-2)] px-2.5 py-1.5 text-[13px] text-[var(--panel-fg)] placeholder:text-[var(--panel-muted)] disabled:opacity-50"
        />
        {expanded && (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px] text-[var(--panel-muted)]">Enter to send · Shift+Enter for new line</span>
            <button
              type="button"
              onClick={submit}
              disabled={disabled || !value.trim()}
              className="focus-ring rounded bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground hover:opacity-90 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        )}
      </div>
    );
  }
);
