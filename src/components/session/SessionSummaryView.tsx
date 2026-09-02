"use client";

import Link from "next/link";
import { SessionSummaryDTO } from "@/lib/client/api";

function Block({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className="list-disc space-y-1 pl-4 text-sm text-foreground/90">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function SessionSummaryView({ summary, sessionId }: { summary: SessionSummaryDTO; sessionId: string }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Session Summary</h1>
        <Link href="/history" className="focus-ring text-sm text-accent hover:underline">
          View all sessions
        </Link>
      </div>

      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <h3 className="mb-2 text-sm font-semibold">Overview</h3>
        <p className="text-sm leading-relaxed text-foreground/90">{summary.rawSummary}</p>
      </div>

      {summary.topics.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-surface p-4">
          <h3 className="mb-2 text-sm font-semibold">Topics discussed</h3>
          <div className="flex flex-wrap gap-1.5">
            {summary.topics.map((t) => (
              <span key={t} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-foreground/90">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {summary.questionsAsked.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-surface p-4">
          <h3 className="mb-2 text-sm font-semibold">Questions asked</h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {summary.questionsAsked.map((q, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">{q.type}</span>
                <span className="text-foreground/90">{q.question}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Block title="Strengths" items={summary.strengths} />
        <Block title="Areas to improve" items={summary.weaknesses} />
      </div>

      <div className="mt-4">
        <Block title="Action items" items={summary.actionItems} />
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          href="/sessions/new"
          className="focus-ring rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          Start Another Session
        </Link>
        <Link
          href={`/history?open=${sessionId}`}
          className="focus-ring rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-surface"
        >
          View Full Transcript
        </Link>
      </div>
    </main>
  );
}
