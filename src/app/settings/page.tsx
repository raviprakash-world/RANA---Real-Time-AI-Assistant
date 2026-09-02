"use client";

import { useEffect, useState } from "react";
import { api, UserPreference } from "@/lib/client/api";
import { useFloatingPreferences } from "@/hooks/useFloatingPreferences";
import { CornerPosition, Density, DEFAULT_FLOATING_UI_PREFS, FontSize, PresentationDisplayChoice, Theme } from "@/lib/floating/types";
import { DesktopCapabilities, WEB_CAPABILITIES, getCapabilities, getDesktopShell } from "@/lib/floating/desktop-capabilities";
import { usePresentationMode } from "@/hooks/usePresentationMode";

const PRESENTATION_DISPLAYS: { value: PresentationDisplayChoice; label: string }[] = [
  { value: "same", label: "Same display" },
  { value: "secondary", label: "Secondary display" },
  { value: "auto", label: "Auto" },
];

const POSITIONS: { value: CornerPosition; label: string }[] = [
  { value: "top-left", label: "Top Left" },
  { value: "top-right", label: "Top Right" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "bottom-right", label: "Bottom Right" },
];

export default function SettingsPage() {
  const [preference, setPreference] = useState<UserPreference | null>(null);
  const [status, setStatus] = useState<{ llmProvider: string; isMock: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const floating = useFloatingPreferences();
  const presentation = usePresentationMode(floating.prefs, floating.update);
  const [capabilities, setCapabilities] = useState<DesktopCapabilities>(WEB_CAPABILITIES);

  useEffect(() => {
    api.getPreferences().then((r) => setPreference(r.preference)).catch((e) => setError(e.message));
    api.status().then(setStatus).catch(() => {});
    // Deferred to an effect (not read during render) so server-rendered HTML
    // and the client's first hydration pass match — window.desktopShell is
    // only meaningfully different from the server's "web" default once
    // we're safely past hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCapabilities(getCapabilities());
  }, []);

  async function save(patch: Partial<UserPreference>) {
    if (!preference) return;
    const next = { ...preference, ...patch };
    setPreference(next);
    setSaving(true);
    setSaved(false);
    try {
      await api.updatePreferences(patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted">Configure the AI assistant&rsquo;s behavior.</p>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <section className="mt-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">AI provider</h2>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Active provider</span>
          <span className="font-medium">
            {status ? (status.isMock ? "Mock (no API key configured)" : status.llmProvider) : "…"}
          </span>
        </div>
        {status?.isMock && (
          <p className="mt-2 text-xs text-warning">
            Set <code className="rounded bg-surface-2 px-1 py-0.5">OPENAI_API_KEY</code> in your{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5">.env</code> file and restart the server for real
            AI responses.
          </p>
        )}
      </section>

      {preference && (
        <section className="mt-4 flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Assistant behavior</h2>

          <label className="flex items-center justify-between text-sm">
            <span>Auto-answer detected questions</span>
            <input
              type="checkbox"
              checked={preference.autoAnswer}
              onChange={(e) => save({ autoAnswer: e.target.checked })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-center justify-between">
              <span>Response creativity (temperature)</span>
              <span className="text-muted">{preference.temperature.toFixed(1)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={preference.temperature}
              onChange={(e) => save({ temperature: parseFloat(e.target.value) })}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-center justify-between">
              <span>Max response length (tokens)</span>
              <span className="text-muted">{preference.maxTokens}</span>
            </span>
            <input
              type="range"
              min={200}
              max={1500}
              step={50}
              value={preference.maxTokens}
              onChange={(e) => save({ maxTokens: parseInt(e.target.value) })}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span>Transcription language</span>
            <select
              value={preference.language}
              onChange={(e) => save({ language: e.target.value })}
              className="focus-ring rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="es-ES">Spanish</option>
              <option value="fr-FR">French</option>
              <option value="de-DE">German</option>
              <option value="hi-IN">Hindi</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-center justify-between">
              <span>Data retention</span>
              <span className="text-muted">{preference.retentionDays} days</span>
            </span>
            <input
              type="range"
              min={1}
              max={90}
              step={1}
              value={preference.retentionDays}
              onChange={(e) => save({ retentionDays: parseInt(e.target.value) })}
            />
          </label>

          <p className="text-xs text-muted">{saving ? "Saving…" : saved ? "Saved." : " "}</p>
        </section>
      )}

      {floating.loaded && (
        <section className="mt-4 flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Floating assistant appearance</h2>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-center justify-between">
              <span>Opacity</span>
              <span className="text-muted">{Math.round(floating.prefs.opacity * 100)}%</span>
            </span>
            <input
              type="range"
              min={0.5}
              max={1}
              step={0.05}
              value={floating.prefs.opacity}
              onChange={(e) => floating.update({ opacity: parseFloat(e.target.value) })}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span>Theme</span>
            <select
              value={floating.prefs.theme}
              onChange={(e) => floating.update({ theme: e.target.value as Theme })}
              className="focus-ring rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span>Density</span>
            <select
              value={floating.prefs.density}
              onChange={(e) => floating.update({ density: e.target.value as Density })}
              className="focus-ring rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
            >
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span>Font size</span>
            <select
              value={floating.prefs.fontSize}
              onChange={(e) => floating.update({ fontSize: e.target.value as FontSize })}
              className="focus-ring rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>

          <fieldset>
            <legend className="mb-2 text-sm">Assistant position</legend>
            <div role="radiogroup" aria-label="Assistant position" className="grid grid-cols-2 gap-2">
              {POSITIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={floating.prefs.position === p.value}
                  onClick={() => floating.update({ position: p.value })}
                  className={`focus-ring rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    floating.prefs.position === p.value
                      ? "border-accent bg-accent/10"
                      : "border-border bg-surface-2 hover:border-accent/40"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center justify-between text-sm">
            <span>Auto-hide after response</span>
            <input
              type="checkbox"
              checked={floating.prefs.autoHide}
              onChange={(e) => floating.update({ autoHide: e.target.checked })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
          </label>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="text-sm">
              <p>Reset position &amp; size</p>
              <p className="text-xs text-muted">Restores the default position, size, and layout if the panel ever ends up off-screen or hard to reach.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                floating.update({ ...DEFAULT_FLOATING_UI_PREFS, theme: floating.prefs.theme, fontSize: floating.prefs.fontSize });
                getDesktopShell()?.resetPosition();
              }}
              className="focus-ring shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
            >
              Reset Position
            </button>
          </div>
        </section>
      )}

      {floating.loaded && (
        <section className="mt-4 flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Presentation mode</h2>
          <p className="text-xs text-muted">
            Shrinks the assistant to a small corner indicator and enables Focus Mode, so it never sits on top of
            content you&rsquo;re sharing. Toggle it any time with Cmd/Ctrl + Shift + H, or here.
          </p>

          <label className="flex items-center justify-between text-sm">
            <span>Presentation mode {presentation.active ? "(active)" : ""}</span>
            <input
              type="checkbox"
              checked={presentation.active}
              onChange={() => presentation.toggle()}
              className="h-4 w-4 accent-[var(--accent)]"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span>Assistant display while presenting</span>
            <select
              value={floating.prefs.presentationDisplay}
              onChange={(e) => floating.update({ presentationDisplay: e.target.value as PresentationDisplayChoice })}
              disabled={!capabilities.multiMonitor}
              className="focus-ring rounded-md border border-border bg-surface-2 px-3 py-2 text-sm disabled:opacity-50"
            >
              {PRESENTATION_DISPLAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              {capabilities.multiMonitor
                ? "Applies the next time presentation mode is turned on. “Secondary” falls back to the current display if only one is connected."
                : "Unsupported on this platform — presentation mode still shrinks the assistant, but can't move it to another display."}
            </span>
          </label>
        </section>
      )}

      {capabilities.platform !== "web" && (
        <section className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Desktop capabilities ({capabilities.platform})</h2>
          <div className="flex flex-col gap-2 text-sm">
            {[
              { label: "Always on top", supported: capabilities.alwaysOnTop },
              { label: "Window transparency", supported: capabilities.transparency, note: capabilities.transparencyNote },
              { label: "Global keyboard shortcuts", supported: capabilities.globalShortcuts },
              { label: "Click-through", supported: capabilities.clickThrough },
              { label: "Multi-monitor recovery", supported: capabilities.multiMonitor },
              { label: "System tray", supported: capabilities.tray },
            ].map((cap) => (
              <div key={cap.label} className="flex items-start justify-between gap-3">
                <span className="text-foreground/90">{cap.label}</span>
                <span className={`shrink-0 text-right text-xs ${cap.supported ? "text-success" : "text-warning"}`}>
                  {cap.supported ? "Supported" : "Unsupported on this platform"}
                  {cap.note && <span className="mt-0.5 block max-w-56 text-muted">{cap.note}</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">
            Esc is intentionally not a global shortcut — claiming it system-wide would break Esc in every other
            app while this one is running. It still collapses the assistant when its window has focus.
          </p>
        </section>
      )}

      <section className="mt-4 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">Keyboard shortcuts</h2>
        <div className="flex flex-col gap-2 text-sm">
          {[
            ["Show / hide assistant", "Cmd/Ctrl + Shift + Space"],
            ["Ask AI", "Cmd/Ctrl + Shift + A"],
            ["Pause / resume", "Cmd/Ctrl + Shift + P"],
            ["Toggle transcript", "Cmd/Ctrl + Shift + T"],
            ["Toggle presentation mode", "Cmd/Ctrl + Shift + H"],
            ...(capabilities.clickThrough ? [["Toggle click-through", "Cmd/Ctrl + Shift + X"]] : []),
            ...(capabilities.multiMonitor ? [["Move to secondary display", "Cmd/Ctrl + Shift + M"]] : []),
            ["Collapse assistant", "Esc (window-focused only)"],
          ].map(([label, keys]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-foreground/90">{label}</span>
              <kbd className="rounded bg-surface-2 px-2 py-1 font-mono text-xs text-muted">{keys}</kbd>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Privacy</h2>
        <p className="text-sm text-foreground/90">
          Audio is only captured while the microphone status shows &ldquo;Listening.&rdquo; Nothing is recorded silently.
          Delete any session (and all its transcript, questions, and AI responses) from the{" "}
          <a href="/history" className="text-accent hover:underline">
            History
          </a>{" "}
          page at any time.
        </p>
      </section>
    </main>
  );
}
