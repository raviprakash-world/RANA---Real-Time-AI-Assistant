"use client";

import { useState } from "react";

const KIND_OPTIONS: { value: "IDE" | "BROWSER" | "TERMINAL" | "SCREEN" | "OTHER"; label: string }[] = [
  { value: "IDE", label: "Code / IDE" },
  { value: "BROWSER", label: "Browser" },
  { value: "TERMINAL", label: "Terminal" },
  { value: "SCREEN", label: "Screen" },
  { value: "OTHER", label: "Other" },
];

export interface AttachedContextItem {
  id: string;
  kind: string;
  filename: string;
}

export function AddContextPanel({
  attached,
  onAdd,
  onClose,
}: {
  attached: AttachedContextItem[];
  onAdd: (entry: { kind: "IDE" | "BROWSER" | "TERMINAL" | "SCREEN" | "OTHER"; label: string; text: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<(typeof KIND_OPTIONS)[number]["value"]>("IDE");
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAdd({ kind, label: label.trim() || KIND_OPTIONS.find((k) => k.value === kind)!.label, text: text.trim() });
      setText("");
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add context");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-b border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Add context</h3>
        <button type="button" onClick={onClose} className="focus-ring text-xs text-muted hover:text-foreground">
          Close
        </button>
      </div>
      <p className="mb-3 text-xs text-muted">
        Paste code, an error, or anything else relevant from your screen — it&rsquo;s added to what the assistant
        considers for its next answer.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            aria-label="Context source type"
            className="focus-ring rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. App.tsx) — optional"
            aria-label="Context label"
            className="focus-ring min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs placeholder:text-muted"
          />
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Paste here…"
          aria-label="Context content"
          className="focus-ring rounded-md border border-border bg-surface-2 px-2.5 py-2 font-mono text-xs placeholder:font-sans placeholder:text-muted"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !text.trim()}
          className="focus-ring self-start rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-40"
        >
          {submitting ? "Adding…" : "Add Context"}
        </button>
      </form>

      {attached.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
          {attached.map((a) => (
            <span key={a.id} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
              {a.kind}: {a.filename}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
