"use client";

import { useState } from "react";

interface Note {
  id: string;
  text: string;
}

// ponytail: localStorage, global across sessions — no schema/API for a
// scratchpad. Add a Prisma model if notes ever need to sync across devices
// or attach to a session's AI context.
const STORAGE_KEY = "rana.notes.v1";
const MAX_NOTES = 50;
const MAX_CHARS = 5000;

function loadNotes(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Quick-notes pad for the floating window: paste (or type) snippets you want
 * to keep in view — talking points, numbers, a link — and copy them back out
 * with one click. Only renders when toggled on (✎ in the header).
 */
export function NotesDrawer({ visible }: { visible: boolean }) {
  // Safe to read localStorage in the initializer: FloatingAssistant renders
  // null until prefs load client-side, so this never runs during SSR/hydration.
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function commit(next: Note[]) {
    setNotes(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setMessage("Couldn't save notes (storage unavailable).");
    }
  }

  function add(text: string) {
    const trimmed = text.trim().slice(0, MAX_CHARS);
    if (!trimmed) return;
    commit([{ id: crypto.randomUUID(), text: trimmed }, ...notes].slice(0, MAX_NOTES));
  }

  async function pasteFromClipboard() {
    setMessage(null);
    try {
      add(await navigator.clipboard.readText());
    } catch {
      setMessage("Clipboard access blocked — paste into the box with ⌘V / Ctrl+V instead.");
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setMessage("Couldn't copy — select the text and copy manually.");
    }
  }

  if (!visible) return null;

  return (
    <div className="flex max-h-56 flex-col border-b border-[var(--panel-border)]">
      <div className="flex items-start gap-1.5 px-3 py-1.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              add(draft);
              setDraft("");
            }
          }}
          rows={2}
          placeholder="Paste or type a note — ⌘/Ctrl+Enter to save"
          aria-label="New note"
          className="focus-ring min-w-0 flex-1 resize-none rounded border border-[var(--panel-border)] bg-[var(--panel-surface-2)] px-2 py-1 text-[11px] text-[var(--panel-fg)] placeholder:text-[var(--panel-muted)]"
        />
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={() => {
              add(draft);
              setDraft("");
            }}
            disabled={!draft.trim()}
            className="focus-ring rounded border border-[var(--panel-border)] px-1.5 py-0.5 text-[10px] text-[var(--panel-muted)] hover:text-[var(--panel-fg)] disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            onClick={pasteFromClipboard}
            title="Save whatever is on your clipboard as a note"
            className="focus-ring rounded border border-[var(--panel-border)] px-1.5 py-0.5 text-[10px] text-[var(--panel-muted)] hover:text-[var(--panel-fg)]"
          >
            Paste
          </button>
        </div>
      </div>
      {message && <p className="px-3 pb-1 text-[10px] text-warning">{message}</p>}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {notes.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-[var(--panel-muted)]">No notes yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {notes.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-2 rounded border border-[var(--panel-border)] px-2 py-1">
                <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[12px] leading-snug text-[var(--panel-fg)]">{n.text}</p>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => copy(n.text)}
                    title="Copy to clipboard"
                    aria-label="Copy note"
                    className="focus-ring rounded border border-[var(--panel-border)] px-1.5 py-0.5 text-[10px] text-[var(--panel-muted)] hover:text-[var(--panel-fg)]"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => commit(notes.filter((x) => x.id !== n.id))}
                    title="Delete note"
                    aria-label="Delete note"
                    className="focus-ring rounded border border-[var(--panel-border)] px-1.5 py-0.5 text-[10px] text-danger hover:bg-danger/10"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
