"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, SessionDetail, SessionListItem } from "@/lib/client/api";
import { SessionSummaryView } from "@/components/session/SessionSummaryView";

const MODE_LABEL: Record<string, string> = {
  INTERVIEW: "Interview",
  CODING: "Coding",
  SYSTEM_DESIGN: "System Design",
  MEETING: "Meeting",
  CUSTOM: "Custom",
};

function formatDuration(sec: number | null) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<main className="flex-1 px-4 py-16 text-center text-sm text-muted">Loading…</main>}>
      <HistoryPageInner />
    </Suspense>
  );
}

function HistoryPageInner() {
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("ALL");
  const [openSession, setOpenSession] = useState<SessionDetail | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId) openDetail(openId);
  }, [searchParams]);

  async function refresh() {
    setLoading(true);
    try {
      const r = await api.listSessions();
      setSessions(r.sessions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(id: string) {
    try {
      const r = await api.getSession(id);
      setOpenSession(r.session);
    } catch {
      // ignore
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this session and all its data? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await api.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (openSession?.id === id) setOpenSession(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete session");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (modeFilter !== "ALL" && s.mode !== modeFilter) return false;
      if (query.trim() && !(s.role || "").toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [sessions, modeFilter, query]);

  if (openSession) {
    return (
      <div className="flex-1">
        <div className="mx-auto max-w-3xl px-4 pt-4">
          <button
            type="button"
            onClick={() => setOpenSession(null)}
            className="focus-ring text-sm text-muted hover:text-foreground"
          >
            ← Back to history
          </button>
        </div>
        {openSession.summary ? (
          <SessionSummaryView summary={openSession.summary} sessionId={openSession.id} />
        ) : (
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
            <h1 className="mb-4 text-xl font-semibold">{MODE_LABEL[openSession.mode]} session</h1>
            <p className="mb-4 text-sm text-muted">No summary was generated for this session.</p>
            <div className="rounded-lg border border-border bg-surface p-4">
              <h3 className="mb-2 text-sm font-semibold">Transcript</h3>
              <div className="flex max-h-96 flex-col gap-2 overflow-y-auto text-sm">
                {openSession.transcriptSegments.map((s) => (
                  <p key={s.id}>
                    <span className="font-medium">{s.speaker}: </span>
                    {s.text}
                  </p>
                ))}
              </div>
            </div>
          </main>
        )}
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">Session History</h1>
      <p className="mt-1 text-sm text-muted">Search, review, and manage past sessions.</p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by role…"
          aria-label="Search sessions by role"
          className="focus-ring rounded-md border border-border bg-surface px-3 py-1.5 text-sm placeholder:text-muted"
        />
        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
          aria-label="Filter by mode"
          className="focus-ring rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
        >
          <option value="ALL">All modes</option>
          {Object.entries(MODE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      {loading && <p className="mt-4 text-sm text-muted">Loading…</p>}

      <div className="mt-6 flex flex-col gap-2">
        {filtered.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4"
          >
            <button type="button" onClick={() => openDetail(s.id)} className="focus-ring flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-accent">{MODE_LABEL[s.mode]}</span>
                <span className="text-xs text-muted">{s.status}</span>
              </div>
              <p className="mt-1 text-sm font-medium">{s.role || "General session"}</p>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                <span>{new Date(s.createdAt).toLocaleString()}</span>
                <span>·</span>
                <span>{formatDuration(s.durationSec)}</span>
                <span>·</span>
                <span>{s._count.questions} questions</span>
              </div>
            </button>
            <div className="flex items-center gap-2">
              {s.status !== "ENDED" && (
                <a
                  href={`/sessions/${s.id}`}
                  className="focus-ring rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface-2"
                >
                  Resume
                </a>
              )}
              <button
                type="button"
                onClick={() => handleDelete(s.id)}
                disabled={deletingId === s.id}
                className="focus-ring rounded-md border border-danger/30 px-2.5 py-1 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <p className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted">
            No sessions match your filters.
          </p>
        )}
      </div>
    </main>
  );
}
