"use client";

import { useEffect, useState } from "react";
import { api, PinnedContext, PinnedContextKind } from "@/lib/client/api";

const KIND_LABEL: Record<PinnedContextKind, string> = {
  RESUME: "Resume",
  JOB_DESCRIPTION: "Job Description",
  IDE: "IDE snippet",
  BROWSER: "Browser snippet",
  TERMINAL: "Terminal output",
  SCREEN: "Screen note",
  OTHER: "Template / prompt fragment",
};

export default function PinnedContextsPage() {
  const [contexts, setContexts] = useState<PinnedContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<PinnedContextKind>("OTHER");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);

  useEffect(() => {
    api
      .listPinnedContexts()
      .then((r) => setContexts(r.contexts))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load pinned contexts"))
      .finally(() => setLoading(false));
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!/\.(txt|md|pdf|docx)$/i.test(file.name)) {
      setError("Only .txt, .md, .pdf, or .docx files are supported — paste the text below instead.");
      e.target.value = "";
      return;
    }
    try {
      setFileBusy(true);
      const content = /\.(pdf|docx)$/i.test(file.name) ? (await api.parseFile(file)).text : await file.text();
      setText(content.slice(0, 20000));
      if (!label) setLabel(file.name.replace(/\.[^.]+$/, ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read this file");
    } finally {
      setFileBusy(false);
      e.target.value = "";
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const r = await api.addPinnedContext({ label: label.trim(), kind, text: text.trim() });
      setContexts((prev) => [r.context, ...prev]);
      setLabel("");
      setText("");
      setKind("OTHER");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save pinned context");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.deletePinnedContext(id);
      setContexts((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete pinned context");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">Pinned Contexts</h1>
      <p className="mt-1 text-sm text-muted">
        Save resumes, job descriptions, or reusable prompt fragments once — attach any of them to a session from{" "}
        <span className="font-medium text-foreground">Start New Session</span> instead of re-uploading every time.
      </p>

      <form onSubmit={handleAdd} className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. Resume — Sept 2026)"
            aria-label="Label"
            className="focus-ring rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as PinnedContextKind)}
            aria-label="Kind"
            className="focus-ring rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {Object.entries(KIND_LABEL).map(([value, l]) => (
              <option key={value} value={value}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Paste the content, or upload a file below"
          className="focus-ring rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted"
        />
        <label className="flex items-center gap-2 text-xs text-muted">
          <span>Or upload (.txt/.md/.pdf/.docx):</span>
          <input
            type="file"
            accept=".txt,.md,.pdf,.docx"
            disabled={fileBusy}
            onChange={handleFile}
            className="focus-ring text-xs text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:text-foreground disabled:opacity-50"
          />
          {fileBusy && <span>Reading…</span>}
        </label>
        {error && <p className="text-xs text-danger">{error}</p>}
        <button
          type="submit"
          disabled={saving || !label.trim() || !text.trim()}
          className="focus-ring self-start rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Pin"}
        </button>
      </form>

      {loading && <p className="mt-6 text-sm text-muted">Loading…</p>}

      <div className="mt-6 flex flex-col gap-2">
        {contexts.map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-accent">{KIND_LABEL[c.kind]}</span>
                <span className="text-xs text-muted">{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="mt-1 text-sm font-medium">{c.label}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{c.text}</p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(c.id)}
              disabled={deletingId === c.id}
              className="focus-ring shrink-0 rounded-md border border-danger/30 px-2.5 py-1 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        ))}
        {!loading && contexts.length === 0 && (
          <p className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted">
            No pinned contexts yet.
          </p>
        )}
      </div>
    </main>
  );
}
