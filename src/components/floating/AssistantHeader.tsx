"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StatusIndicator, AssistantStatus } from "@/components/StatusIndicator";

const MODE_LABEL: Record<string, string> = {
  INTERVIEW: "Interview",
  CODING: "Coding",
  SYSTEM_DESIGN: "System Design",
  MEETING: "Meeting",
  CUSTOM: "Custom",
};

/** A compact dark-glass pill with an optional trailing keyboard-shortcut hint (reference section 5). */
function ToolbarPill({
  onClick,
  active,
  shortcut,
  label,
  ariaLabel,
}: {
  onClick: () => void;
  active?: boolean;
  shortcut?: string;
  label: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel ?? label}
      className={`focus-ring flex shrink-0 items-center gap-1.5 rounded-[var(--panel-radius-sm)] border px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? "border-accent/40 bg-accent/15 text-accent"
          : "border-[var(--panel-border)] bg-[var(--panel-surface-2)] text-[var(--panel-muted)] hover:border-[var(--panel-border-hover)] hover:text-[var(--panel-fg)]"
      }`}
    >
      {label}
      {shortcut && <span className="font-mono text-[9px] opacity-60">{shortcut}</span>}
    </button>
  );
}

/** Small icon-only utility pill (Focus, Present, More, Minimize). */
function ToolbarIconButton({
  onClick,
  active,
  warn,
  title,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  warn?: boolean;
  title: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      aria-label={ariaLabel ?? title}
      className={`focus-ring flex shrink-0 items-center justify-center rounded-[var(--panel-radius-sm)] border px-1.5 py-1 text-[12px] leading-none transition-colors ${
        warn
          ? "border-warning/40 bg-warning/15 text-warning"
          : active
            ? "border-accent/40 bg-accent/15 text-accent"
            : "border-[var(--panel-border)] bg-[var(--panel-surface-2)] text-[var(--panel-muted)] hover:border-[var(--panel-border-hover)] hover:text-[var(--panel-fg)]"
      }`}
    >
      {children}
    </button>
  );
}

export function AssistantHeader({
  mode,
  status,
  contextCount,
  background,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  onMinimize,
  onToggleTranscript,
  transcriptVisible,
  onToggleContext,
  onClearHistory,
  onTogglePause,
  isPaused,
  onEnd,
  focusMode,
  onToggleFocusMode,
  onFocusAsk,
  presentationActive,
  onTogglePresentation,
  desktop,
}: {
  mode: string;
  status: AssistantStatus;
  contextCount: number;
  /** This layer's tier of the glass stack — see panelLayerBackground. */
  background: string;
  onDragPointerDown: (e: React.PointerEvent) => void;
  onDragPointerMove: (e: React.PointerEvent) => void;
  onDragPointerUp: (e: React.PointerEvent) => void;
  onMinimize: () => void;
  onToggleTranscript: () => void;
  transcriptVisible: boolean;
  onToggleContext: () => void;
  onClearHistory: () => void;
  onTogglePause: () => void;
  isPaused: boolean;
  onEnd: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  onFocusAsk: () => void;
  presentationActive: boolean;
  onTogglePresentation: () => void;
  /** Present only when running inside the desktop shell (see FloatingAssistant.tsx). */
  desktop?: {
    alwaysOnTop: boolean;
    onToggleAlwaysOnTop: () => void;
    clickThroughActive: boolean;
    onToggleClickThrough: () => void;
    onMoveToSecondary: () => void;
  };
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  return (
    <div
      className="floating-layer flex shrink-0 cursor-grab items-center gap-1.5 px-2.5 py-2 active:cursor-grabbing"
      onPointerDown={onDragPointerDown}
      onPointerMove={onDragPointerMove}
      onPointerUp={onDragPointerUp}
      style={{ touchAction: "none", backgroundColor: background }}
    >
      <div className="flex min-w-0 shrink-0 items-center gap-1.5 pr-1">
        <StatusIndicator status={status} />
        <span className="hidden shrink-0 rounded bg-[var(--panel-surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--panel-muted)] sm:inline">
          {MODE_LABEL[mode] ?? mode}
        </span>
      </div>

      {!focusMode && (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          <ToolbarPill label="Ask AI" shortcut="⌘⇧A" onClick={onFocusAsk} />
          <ToolbarPill label={isPaused ? "Resume" : "Pause"} shortcut="⌘⇧P" active={isPaused} onClick={onTogglePause} />
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {/* Lives here (not the pill row above) specifically so it's still reachable
            in Focus Mode — that row is hidden there, but you should still be able
            to check the transcript regardless of which mode you're in. */}
        <ToolbarIconButton title={transcriptVisible ? "Hide transcript (⌘⇧T)" : "Show transcript (⌘⇧T)"} active={transcriptVisible} onClick={onToggleTranscript}>
          ☰
        </ToolbarIconButton>
        <ToolbarIconButton title={presentationActive ? "Exit presentation mode" : "Presentation mode (⌘⇧H)"} active={presentationActive} onClick={onTogglePresentation}>
          ▤
        </ToolbarIconButton>
        <ToolbarIconButton title={focusMode ? "Exit focus mode" : "Focus mode"} active={focusMode} onClick={onToggleFocusMode}>
          ◎
        </ToolbarIconButton>

        <div ref={menuRef} className="relative">
          <ToolbarIconButton title="More" ariaLabel="More options" active={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            ⋯
          </ToolbarIconButton>
          {menuOpen && (
            <div
              role="menu"
              className="floating-layer absolute right-0 top-[calc(100%+6px)] z-10 flex w-44 flex-col gap-0.5 bg-[rgba(20,21,25,0.96)] p-1.5 text-[12px] text-[var(--panel-fg)]"
            >
              {!focusMode && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onToggleContext();
                    setMenuOpen(false);
                  }}
                  className="focus-ring rounded-[var(--panel-radius-sm)] px-2 py-1.5 text-left hover:bg-[var(--panel-surface-2)]"
                >
                  Add context{contextCount > 0 ? ` (${contextCount})` : ""}
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onClearHistory();
                  setMenuOpen(false);
                }}
                className="focus-ring rounded-[var(--panel-radius-sm)] px-2 py-1.5 text-left text-danger hover:bg-danger/10"
              >
                Clear history
              </button>
              {desktop && (
                <>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={desktop.alwaysOnTop}
                    onClick={() => {
                      desktop.onToggleAlwaysOnTop();
                      setMenuOpen(false);
                    }}
                    className="focus-ring rounded-[var(--panel-radius-sm)] px-2 py-1.5 text-left hover:bg-[var(--panel-surface-2)]"
                  >
                    {desktop.alwaysOnTop ? "✓ " : ""}Always on top
                  </button>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={desktop.clickThroughActive}
                    onClick={() => {
                      desktop.onToggleClickThrough();
                      setMenuOpen(false);
                    }}
                    className="focus-ring rounded-[var(--panel-radius-sm)] px-2 py-1.5 text-left hover:bg-[var(--panel-surface-2)]"
                  >
                    {desktop.clickThroughActive ? "✓ " : ""}Click-through
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      desktop.onMoveToSecondary();
                      setMenuOpen(false);
                    }}
                    className="focus-ring rounded-[var(--panel-radius-sm)] px-2 py-1.5 text-left hover:bg-[var(--panel-surface-2)]"
                  >
                    Move to secondary display
                  </button>
                </>
              )}
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="focus-ring rounded-[var(--panel-radius-sm)] px-2 py-1.5 text-left hover:bg-[var(--panel-surface-2)]"
              >
                Settings
              </Link>
            </div>
          )}
        </div>

        <ToolbarIconButton title="Minimize" onClick={onMinimize}>
          −
        </ToolbarIconButton>
        <button
          type="button"
          onClick={onEnd}
          title="End session"
          aria-label="End session"
          className="focus-ring ml-0.5 shrink-0 rounded-[var(--panel-radius-sm)] border border-danger/30 bg-danger/15 px-2.5 py-1 text-[11px] font-semibold text-danger hover:bg-danger/25"
        >
          End
        </button>
      </div>
    </div>
  );
}
