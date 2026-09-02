"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, CreateSessionInput } from "@/lib/client/api";

const MODES: { value: CreateSessionInput["mode"]; label: string; blurb: string }[] = [
  { value: "INTERVIEW", label: "Interview", blurb: "Interviewer questions & answer suggestions" },
  { value: "CODING", label: "Coding", blurb: "Algorithms, debugging, technical questions" },
  { value: "SYSTEM_DESIGN", label: "System Design", blurb: "Architecture and tradeoffs" },
  { value: "MEETING", label: "Meeting", blurb: "Notes, decisions, action items" },
  { value: "CUSTOM", label: "Custom", blurb: "Define your own purpose/context" },
];

const ROLES = [
  "Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "Software Engineer",
  "System Design",
  "Behavioral / HR",
  "Custom",
];

const EXPERIENCE = ["Entry-Level", "Mid-Level", "Senior", "Staff+"];

export default function NewSessionPage() {
  const router = useRouter();
  const [mode, setMode] = useState<CreateSessionInput["mode"]>("INTERVIEW");
  const [role, setRole] = useState(ROLES[0]);
  const [experience, setExperience] = useState(EXPERIENCE[1]);
  const [context, setContext] = useState("");
  const [instructions, setInstructions] = useState("");
  const [uploadedContext, setUploadedContext] = useState<CreateSessionInput["uploadedContext"]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingKind, setUploadingKind] = useState<"RESUME" | "JOB_DESCRIPTION" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>, kind: "RESUME" | "JOB_DESCRIPTION") {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!/\.(txt|md|pdf|docx)$/i.test(file.name)) {
      setUploadError(
        /\.doc$/i.test(file.name)
          ? "Old-format .doc files aren't supported — save it as .docx or paste the text into Context instead."
          : "Only .txt, .md, .pdf, or .docx files are supported — paste the text into Context instead."
      );
      e.target.value = "";
      return;
    }

    try {
      let text: string;
      if (/\.(pdf|docx)$/i.test(file.name)) {
        setUploadingKind(kind);
        const result = await api.parseFile(file);
        text = result.text;
      } else {
        text = await file.text();
      }
      setUploadedContext((prev) => [
        ...(prev ?? []).filter((u) => u.kind !== kind),
        { kind, filename: file.name, text: text.slice(0, 20000) },
      ]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to read this file");
      e.target.value = "";
    } finally {
      setUploadingKind(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { session } = await api.createSession({
        mode,
        role: mode === "CUSTOM" ? undefined : role,
        experience,
        context: context || undefined,
        additionalInstructions: instructions || undefined,
        uploadedContext: uploadedContext?.length ? uploadedContext : undefined,
      });
      router.push(`/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">Start New Session</h1>
      <p className="mt-1 text-sm text-muted">Set up context once — the assistant uses it for every answer during this session.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Mode</legend>
          <div role="radiogroup" aria-label="Session mode" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MODES.map((m) => (
              <button
                type="button"
                key={m.value}
                role="radio"
                aria-checked={mode === m.value}
                onClick={() => setMode(m.value)}
                className={`focus-ring rounded-lg border p-3 text-left transition-colors ${
                  mode === m.value ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/40"
                }`}
              >
                <div className="text-sm font-medium">{m.label}</div>
                <div className="mt-0.5 text-xs text-muted">{m.blurb}</div>
              </button>
            ))}
          </div>
        </fieldset>

        {mode !== "CUSTOM" && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="focus-ring rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Experience</span>
          <select
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            className="focus-ring rounded-md border border-border bg-surface px-3 py-2 text-sm"
          >
            {EXPERIENCE.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Context (optional)</span>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={3}
            placeholder="e.g. Interviewing for a Series B fintech startup, focus on payments infra"
            className="focus-ring rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Resume (.txt/.md/.pdf/.docx, optional)</span>
            <input
              type="file"
              accept=".txt,.md,.pdf,.docx"
              disabled={uploadingKind !== null}
              onChange={(e) => handleFile(e, "RESUME")}
              className="focus-ring text-xs text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:text-foreground disabled:opacity-50"
            />
            {uploadingKind === "RESUME" && <span className="text-[11px] text-muted">Reading file…</span>}
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Job description (.txt/.md/.pdf/.docx, optional)</span>
            <input
              type="file"
              accept=".txt,.md,.pdf,.docx"
              disabled={uploadingKind !== null}
              onChange={(e) => handleFile(e, "JOB_DESCRIPTION")}
              className="focus-ring text-xs text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:text-foreground disabled:opacity-50"
            />
            {uploadingKind === "JOB_DESCRIPTION" && <span className="text-[11px] text-muted">Reading file…</span>}
          </label>
        </div>
        {uploadError && <p className="text-xs text-danger">{uploadError}</p>}
        {uploadedContext && uploadedContext.length > 0 && (
          <p className="text-xs text-success">
            Attached: {uploadedContext.map((u) => u.filename).join(", ")}
          </p>
        )}

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Additional instructions (optional)</span>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={2}
            placeholder="e.g. Keep answers under 3 sentences, focus on backend depth"
            className="focus-ring rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted"
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="focus-ring rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Starting…" : "Start Session"}
        </button>
      </form>
    </main>
  );
}
