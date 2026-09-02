"use client";

import { memo, useMemo, useState } from "react";
import { LiveTranscriptSegment } from "@/hooks/useSessionEvents";

const SPEAKER_LABEL: Record<string, string> = {
  INTERVIEWER: "Interviewer",
  USER: "You",
  UNKNOWN: "Speaker",
};

/**
 * Memoized so a transcript re-render (new segment arriving) never forces
 * the rest of the floating panel (response views, header) to re-render too
 * (section 25) — this component owns its own scroll/search state and only
 * depends on the segment list + partial-text props.
 */
export const TranscriptDrawer = memo(function TranscriptDrawer({
  segments,
  partialText,
  visible,
  speakerTag,
  onToggleSpeakerTag,
}: {
  segments: LiveTranscriptSegment[];
  partialText: string;
  visible: boolean;
  speakerTag: "USER" | "UNKNOWN";
  onToggleSpeakerTag: () => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return segments;
    const q = query.toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, query]);

  if (!visible) return null;

  return (
    <div className="flex max-h-40 flex-col border-b border-[var(--panel-border)]">
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          aria-label="Search transcript"
          className="focus-ring min-w-0 flex-1 rounded border border-[var(--panel-border)] bg-[var(--panel-surface-2)] px-2 py-1 text-[11px] text-[var(--panel-fg)] placeholder:text-[var(--panel-muted)]"
        />
        <button
          type="button"
          onClick={onToggleSpeakerTag}
          aria-pressed={speakerTag === "USER"}
          title="Tag new speech as yours or the other party's"
          className="focus-ring shrink-0 rounded border border-[var(--panel-border)] px-1.5 py-1 text-[10px] text-[var(--panel-muted)] hover:text-[var(--panel-fg)]"
        >
          {speakerTag === "USER" ? "Me" : "Them"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {filtered.length === 0 && !partialText && (
          <p className="py-2 text-center text-[11px] text-[var(--panel-muted)]">Transcript will appear here.</p>
        )}
        <div className="flex flex-col gap-1.5">
          {filtered.map((s) => (
            <p key={s.id} className="text-[12px] leading-snug">
              <span className={`font-medium ${s.speaker === "USER" ? "text-accent" : "text-[var(--panel-fg)]"}`}>
                {SPEAKER_LABEL[s.speaker] ?? s.speaker}:{" "}
              </span>
              <span className="text-[var(--panel-muted)]">{s.text}</span>
            </p>
          ))}
          {partialText && <p className="text-[12px] italic text-[var(--panel-muted)]">{partialText}…</p>}
        </div>
      </div>
    </div>
  );
});
