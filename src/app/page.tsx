"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, SessionListItem } from "@/lib/client/api";

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

export default function DashboardPage() {
  const [sessions, setSessions] = useState<SessionListItem[] | null>(null);
  const [isMock, setIsMock] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listSessions()
      .then((r) => setSessions(r.sessions.slice(0, 6)))
      .catch((e) => setError(e.message));
    api
      .status()
      .then((r) => setIsMock(r.isMock))
      .catch(() => setIsMock(null));
  }, []);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      {isMock && (
        <div className="mb-6 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Running with a mock AI provider — set <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">OPENAI_API_KEY</code> in{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">.env</code> to get real responses. The full pipeline
          (transcript → detection → answer) works today, it just returns labeled mock content.
        </div>
      )}

      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Start a session or pick up where you left off.</p>
        </div>
        <Link
          href="/sessions/new"
          className="focus-ring rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          Start New Session
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted">Recent sessions</h2>
        {error && <p className="text-sm text-danger">{error}</p>}
        {sessions === null && !error && <p className="text-sm text-muted">Loading…</p>}
        {sessions && sessions.length === 0 && (
          <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted">
            No sessions yet. Start your first session to see it here.
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessions?.map((s) => (
            <Link
              key={s.id}
              href={s.status === "ENDED" ? `/history?open=${s.id}` : `/sessions/${s.id}`}
              className="focus-ring group rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent/50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-accent">
                  {MODE_LABEL[s.mode] ?? s.mode}
                </span>
                <span
                  className={`text-xs ${
                    s.status === "ACTIVE" ? "text-success" : s.status === "PAUSED" ? "text-warning" : "text-muted"
                  }`}
                >
                  {s.status}
                </span>
              </div>
              <p className="mt-2 truncate text-sm font-medium text-foreground">{s.role || "General session"}</p>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                <span>·</span>
                <span>{formatDuration(s.durationSec)}</span>
                <span>·</span>
                <span>{s._count.questions} questions</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
