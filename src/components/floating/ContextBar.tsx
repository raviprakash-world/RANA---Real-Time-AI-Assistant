"use client";

/**
 * The secondary "what's currently being answered" strip between the
 * toolbar and the main response panel (reference section 6). Shows the
 * most recently detected question with a small listening-activity
 * indicator, a Clear action to dismiss it (until the next question
 * arrives), and an Expand action that jumps into Focus Mode for it.
 *
 * The bar bars aren't decoded from real microphone amplitude — there's no
 * audio analyser wired up in this app — they're a lightweight "actively
 * listening" activity cue tied to the real `listening` status, same spirit
 * as the pulsing status dot used elsewhere.
 */
function AudioLevel({ active }: { active: boolean }) {
  const heights = [40, 90, 55, 100, 45];
  return (
    <div className="flex h-3.5 shrink-0 items-end gap-[2px]" aria-hidden>
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full bg-accent ${active ? "audio-bar" : ""}`}
          style={{ height: `${h}%`, animationDelay: `${i * 90}ms`, opacity: active ? 1 : 0.35 }}
        />
      ))}
    </div>
  );
}

export function ContextBar({
  question,
  listening,
  background,
  onClear,
  onExpand,
}: {
  question: string;
  listening: boolean;
  /** This layer's tier of the glass stack — see panelLayerBackground. */
  background: string;
  onClear: () => void;
  onExpand: () => void;
}) {
  return (
    <div className="floating-layer response-enter flex shrink-0 items-center gap-2 px-2.5 py-1.5" style={{ backgroundColor: background }}>
      <AudioLevel active={listening} />
      <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--panel-fg)]" title={question}>
        {question}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="focus-ring shrink-0 rounded-[var(--panel-radius-sm)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--panel-muted)] hover:text-[var(--panel-fg)]"
      >
        Clear
      </button>
      <button
        type="button"
        onClick={onExpand}
        aria-label="Focus on this answer"
        title="Focus on this answer"
        className="focus-ring shrink-0 rounded-[var(--panel-radius-sm)] px-1.5 py-0.5 text-[12px] text-[var(--panel-muted)] hover:text-[var(--panel-fg)]"
      >
        ⛶
      </button>
    </div>
  );
}
