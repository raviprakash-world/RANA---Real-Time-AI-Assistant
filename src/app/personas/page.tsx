"use client";

import { useEffect, useState } from "react";
import { api, Persona } from "@/lib/client/api";

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .listPersonas()
      .then((r) => setPersonas(r.personas))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load personas"))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const r = await api.addPersona({
        name: name.trim(),
        role: role.trim() || undefined,
        experience: experience.trim() || undefined,
        additionalInstructions: instructions.trim() || undefined,
      });
      setPersonas((prev) => [r.persona, ...prev]);
      setName("");
      setRole("");
      setExperience("");
      setInstructions("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save persona");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.deletePersona(id);
      setPersonas((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete persona");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">Personas</h1>
      <p className="mt-1 text-sm text-muted">
        Save a role, experience level, and standing instructions as a preset — pick one from{" "}
        <span className="font-medium text-foreground">Start New Session</span> to prefill the form instead of
        re-entering it every time (e.g. &quot;Frontend Developer Mode&quot; vs &quot;Backend Developer Mode&quot;).
      </p>

      <form onSubmit={handleAdd} className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Persona name (e.g. Backend Developer Mode)"
          aria-label="Persona name"
          className="focus-ring rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Role (e.g. Backend Developer)"
            aria-label="Role"
            className="focus-ring rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted"
          />
          <input
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            placeholder="Experience (e.g. Senior)"
            aria-label="Experience"
            className="focus-ring rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted"
          />
        </div>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={2}
          placeholder="Standing instructions (optional) — e.g. Focus on distributed systems depth"
          className="focus-ring rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="focus-ring self-start rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Persona"}
        </button>
      </form>

      {loading && <p className="mt-6 text-sm text-muted">Loading…</p>}

      <div className="mt-6 flex flex-col gap-2">
        {personas.map((p) => (
          <div key={p.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{p.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                {p.role && <span>{p.role}</span>}
                {p.role && p.experience && <span>·</span>}
                {p.experience && <span>{p.experience}</span>}
              </div>
              {p.additionalInstructions && <p className="mt-1 line-clamp-2 text-xs text-muted">{p.additionalInstructions}</p>}
            </div>
            <button
              type="button"
              onClick={() => handleDelete(p.id)}
              disabled={deletingId === p.id}
              className="focus-ring shrink-0 rounded-md border border-danger/30 px-2.5 py-1 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        ))}
        {!loading && personas.length === 0 && (
          <p className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted">
            No personas saved yet.
          </p>
        )}
      </div>
    </main>
  );
}
