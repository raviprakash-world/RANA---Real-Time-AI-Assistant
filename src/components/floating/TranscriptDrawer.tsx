"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { LiveTranscriptSegment } from "@/hooks/useSessionEvents";

const SPEAKER_LABEL: Record<string, string> = {
  INTERVIEWER: "Interviewer",
  USER: "You",
  UNKNOWN: "Speaker",
};

const BOTTOM_THRESHOLD_PX = 24;

/**
 * A manual fallback for whenever auto-detection misses something (garbled
 * audio, a question phrased in a way the detector doesn't recognize, etc.)
 * — pick the actual line out of the transcript and ask RANA to answer it
 * directly, reusing the exact same manual "Ask AI" pipeline the Ask AI box
 * uses (no new backend needed, just a second entry point into it).
 */
function AskAboutButton({ text, onAskAbout }: { text: string; onAskAbout: (text: string) => void }) {
  const [asked, setAsked] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        onAskAbout(text);
        setAsked(true);
        setTimeout(() => setAsked(false), 1500);
      }}
      disabled={asked}
      title="Ask RANA to answer this"
      aria-label="Ask RANA to answer this"
      className="focus-ring shrink-0 rounded border border-[var(--panel-border)] px-1.5 py-0.5 text-[10px] text-[var(--panel-muted)] hover:border-accent/40 hover:text-accent disabled:opacity-60"
    >
      {asked ? "Asked ✓" : "Ask"}
    </button>
  );
}

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
  onAskAbout,
}: {
  segments: LiveTranscriptSegment[];
  partialText: string;
  visible: boolean;
  speakerTag: "USER" | "UNKNOWN";
  onToggleSpeakerTag: () => void;
  /** Manually ask RANA to answer a specific transcript line — see AskAboutButton. */
  onAskAbout: (text: string) => void;
}) {
  const [query, setQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  const filtered = useMemo(() => {
    if (!query.trim()) return segments;
    const q = query.toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, query]);

  // Auto-scroll to the newest line only while the user is already at the
  // bottom — scrolling up to read back disables it until they scroll back
  // down, so new transcript never yanks the view out from under them.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight;
  }, [filtered, partialText]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX;
  }

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
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 pb-2">
        {filtered.length === 0 && !partialText && (
          <p className="py-2 text-center text-[11px] text-[var(--panel-muted)]">Transcript will appear here.</p>
        )}
        <div className="flex flex-col gap-1.5">
          {filtered.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-[12px] leading-snug">
                <span className={`font-medium ${s.speaker === "USER" ? "text-accent" : "text-[var(--panel-fg)]"}`}>
                  {SPEAKER_LABEL[s.speaker] ?? s.speaker}:{" "}
                </span>
                <span className="text-[var(--panel-muted)]">{s.text}</span>
              </p>
              {/* Only the other party's speech can be "the question" — matches
                  which speakers trigger auto-detection server-side. */}
              {s.speaker !== "USER" && <AskAboutButton text={s.text} onAskAbout={onAskAbout} />}
            </div>
          ))}
          {partialText && <p className="text-[12px] italic text-[var(--panel-muted)]">{partialText}…</p>}
        </div>
      </div>
    </div>
  );
});
