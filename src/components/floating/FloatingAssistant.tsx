"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LiveQuestion, LiveResponse, LiveTranscriptSegment } from "@/hooks/useSessionEvents";
import { useDraggable } from "@/hooks/useDraggable";
import { useResizable } from "@/hooks/useResizable";
import { useFloatingPreferences } from "@/hooks/useFloatingPreferences";
import { AssistantStatus, StatusIndicator } from "@/components/StatusIndicator";
import { AssistantHeader } from "./AssistantHeader";
import { CompactIndicator } from "./CompactIndicator";
import { ContextBar } from "./ContextBar";
import { TranscriptDrawer } from "./TranscriptDrawer";
import { AskAIInput } from "./AskAIInput";
import { ResizeHandle } from "./ResizeHandle";
import { ResponseCard } from "./ResponseCard";
import { AddContextPanel, AttachedContextItem } from "@/components/session/AddContextPanel";
import { clampCollapsedTop, floatingContainerStyle, panelLayerBackground } from "@/lib/floating/layout";
import { getDesktopShell } from "@/lib/floating/desktop-capabilities";
import { useDesktopBoundsCorrection, useDesktopClickThroughState, useDesktopShortcuts } from "@/hooks/useDesktopShell";
import { usePresentationMode } from "@/hooks/usePresentationMode";
import {
  AUTO_HIDE_DELAY_MS,
  CORNER_MARGIN,
  FLOATING_MAX_HEIGHT,
  FLOATING_MAX_WIDTH,
  FLOATING_MIN_HEIGHT,
  FLOATING_MIN_WIDTH,
} from "@/lib/floating/types";

const FONT_SIZE_PX: Record<string, number> = { small: 12, medium: 13.5, large: 15.5 };

function useResolvedPanelTheme(theme: "dark" | "light" | "system") {
  const [systemLight, setSystemLight] = useState(false);
  useEffect(() => {
    // matchMedia isn't available during SSR, so this genuinely needs an
    // effect rather than a render-time/lazy-init check.
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSystemLight(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemLight(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return theme === "system" ? (systemLight ? "light" : "dark") : theme;
}

export interface FloatingAssistantProps {
  mode: string;
  status: AssistantStatus;
  aiThinking: boolean;
  streamingText: string;
  questions: LiveQuestion[];
  responses: LiveResponse[];
  segments: LiveTranscriptSegment[];
  partialText: string;
  isPaused: boolean;
  onTogglePause: () => void;
  onEnd: () => void;
  onAsk: (instruction: string) => void;
  onClearHistory: () => Promise<void>;
  attachedContext: AttachedContextItem[];
  onAddContext: (entry: { kind: "IDE" | "BROWSER" | "TERMINAL" | "SCREEN" | "OTHER"; label: string; text: string }) => Promise<void>;
  speakerTag: "USER" | "UNKNOWN";
  onToggleSpeakerTag: () => void;
  micBanner?: React.ReactNode;
  errorBanner?: React.ReactNode;
}

export function FloatingAssistant(props: FloatingAssistantProps) {
  const { prefs, update, loaded } = useFloatingPreferences();
  const panelRef = useRef<HTMLElement>(null);
  const [contextVisible, setContextVisible] = useState(false);
  const askRef = useRef<HTMLTextAreaElement>(null);
  const resolvedTheme = useResolvedPanelTheme(prefs.theme);
  // Local-only UI state (never persisted/sent anywhere): which response the
  // viewer marked helpful/not, and which detected question they dismissed
  // from the context bar (reset the moment a newer question arrives, since
  // it's keyed by question id).
  const [feedback, setFeedback] = useState<Record<string, "up" | "down" | null>>({});
  const [dismissedContextId, setDismissedContextId] = useState<string | null>(null);

  const reportDesktopBounds = () => {
    const shell = getDesktopShell();
    if (!shell || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    shell.reportBounds({ x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) });
  };

  const drag = useDraggable(panelRef, (pos) => {
    update({ position: "custom", x: pos.x, y: pos.y });
    reportDesktopBounds();
  });
  const resize = useResizable(
    panelRef,
    { minWidth: FLOATING_MIN_WIDTH, minHeight: FLOATING_MIN_HEIGHT, maxWidth: FLOATING_MAX_WIDTH, maxHeight: FLOATING_MAX_HEIGHT },
    (size) => {
      update({ width: size.width, height: size.height });
      reportDesktopBounds();
    }
  );

  // Mirror bounds to the desktop shell's OS window whenever the panel
  // collapses/expands too (not just drag/resize) — the HUD window itself
  // shrinks to the pill's size and back, so click-through/positioning stay
  // accurate. Runs after paint so getBoundingClientRect reflects the new state.
  useEffect(() => {
    if (!getDesktopShell()) return;
    const id = requestAnimationFrame(reportDesktopBounds);
    return () => cancelAnimationFrame(id);
  }, [prefs.collapsed]);

  // Desktop shell tells us when it had to snap the OS window back on-screen
  // (multi-monitor recovery) — keep our own persisted position in sync.
  useDesktopBoundsCorrection((bounds) => {
    update({ position: "custom", x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
  });

  // Responsive safeguard (section 24): a saved width/height/position can
  // exceed a smaller viewport (a narrower browser window, or moving to a
  // smaller screen) — reflow it back into bounds on mount and on resize
  // rather than letting it overflow or run off-screen.
  useEffect(() => {
    if (!loaded) return;
    function clampToViewport() {
      if (prefs.collapsed) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(prefs.width, Math.max(vw - CORNER_MARGIN * 2, FLOATING_MIN_WIDTH));
      const height = Math.min(prefs.height, Math.max(vh - CORNER_MARGIN * 2, FLOATING_MIN_HEIGHT));
      const patch: Partial<typeof prefs> = {};
      if (width !== prefs.width) patch.width = width;
      if (height !== prefs.height) patch.height = height;

      if (prefs.position === "custom") {
        const x = Math.min(Math.max(prefs.x, 0), Math.max(vw - width, 0));
        const y = Math.min(Math.max(prefs.y, 0), Math.max(vh - height, 0));
        if (x !== prefs.x) patch.x = x;
        if (y !== prefs.y) patch.y = y;
      }

      if (Object.keys(patch).length > 0) update(patch);
    }
    clampToViewport();
    window.addEventListener("resize", clampToViewport);
    return () => window.removeEventListener("resize", clampToViewport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, prefs.width, prefs.height, prefs.x, prefs.y, prefs.position, prefs.collapsed]);

  // Auto-hide: collapse to the compact indicator a while after a response
  // finishes, unless auto-hide is off. Never hides while capture is active
  // without leaving the status dot visible (the compact indicator always
  // shows it) — see section 21 of the spec.
  useEffect(() => {
    if (!prefs.autoHide || prefs.collapsed || props.aiThinking || props.responses.length === 0) return;
    const timer = setTimeout(() => update({ collapsed: true }), AUTO_HIDE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.responses.length, prefs.autoHide, props.aiThinking]);

  // Presentation Mode (screen-sharing-friendly): forces compact + focus so
  // the assistant never sits on top of shared content, and on desktop can
  // move to another display. See usePresentationMode for the snapshot/
  // restore behavior shared with the Settings page's manual toggle.
  const { toggle: togglePresentationMode } = usePresentationMode(prefs, update);

  // Shared dispatch for both the page-scoped keydown handler (below) and
  // OS-level global shortcuts routed in via the desktop shell (section 6) —
  // one action table, two triggers, no duplicated behavior.
  function runShortcutAction(
    action: "toggle-visibility" | "focus-ask" | "toggle-pause" | "toggle-transcript" | "end-session" | "toggle-presentation"
  ) {
    if (action === "toggle-visibility") {
      update({ collapsed: !prefs.collapsed });
    } else if (action === "focus-ask") {
      update({ collapsed: false });
      askRef.current?.focus();
    } else if (action === "toggle-pause") {
      props.onTogglePause();
    } else if (action === "toggle-transcript") {
      update({ transcriptVisible: !prefs.transcriptVisible });
    } else if (action === "end-session") {
      props.onEnd();
    } else if (action === "toggle-presentation") {
      togglePresentationMode();
    }
  }

  // Every response (auto-detected or manual) with its question text (if
  // any), oldest first — the sequence Focus Mode's ⌘←/⌘→ steps through.
  const focusFeedItems = useMemo(() => {
    const items = props.responses.map((r) => ({
      id: r.id,
      payload: r.payload,
      questionText: r.questionId ? props.questions.find((q) => q.id === r.questionId)?.question : undefined,
      receivedAt: r.receivedAt,
    }));
    items.sort((a, b) => a.receivedAt - b.receivedAt);
    return items;
  }, [props.responses, props.questions]);

  // null = pinned to the latest item (auto-advances as new answers arrive,
  // same "don't fight the user, but snap back once they're caught up"
  // pattern as the transcript's auto-scroll). Set to a real index only
  // while the user has manually stepped back with ⌘←.
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const clampedFocusIndex = focusIndex === null ? focusFeedItems.length - 1 : Math.min(focusIndex, focusFeedItems.length - 1);
  const latestFeedItem = focusFeedItems[clampedFocusIndex] ?? null;

  function navigateFocus(delta: number) {
    if (focusFeedItems.length === 0) return;
    const next = Math.max(0, Math.min(focusFeedItems.length - 1, clampedFocusIndex + delta));
    setFocusIndex(next === focusFeedItems.length - 1 ? null : next);
  }

  // Global keyboard shortcuts for the floating panel itself (page-scoped —
  // only active while this window/tab has focus).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !prefs.collapsed) {
        update({ collapsed: true });
        return;
      }
      // Focus Mode history nav (⌘←/⌘→, no Shift — matches the reference).
      // Only meaningful in Focus Mode, which also happens to be the one
      // state where the Ask AI textarea isn't mounted, so there's nothing
      // else on this page for the arrow keys to conflict with.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && prefs.focusMode && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        navigateFocus(e.key === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (key === " " || e.code === "Space") {
        e.preventDefault();
        runShortcutAction("toggle-visibility");
      } else if (key === "a") {
        e.preventDefault();
        runShortcutAction("focus-ask");
      } else if (key === "p") {
        e.preventDefault();
        runShortcutAction("toggle-pause");
      } else if (key === "t") {
        e.preventDefault();
        runShortcutAction("toggle-transcript");
      } else if (key === "h") {
        e.preventDefault();
        runShortcutAction("toggle-presentation");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.collapsed, prefs.transcriptVisible, prefs.focusMode, clampedFocusIndex, focusFeedItems.length]);

  // Same actions, triggered by the desktop shell's OS-level global
  // shortcuts (work even when another app has focus — see electron/main.js).
  // No-op in a plain browser tab.
  useDesktopShortcuts(runShortcutAction);

  // Reflect click-through state (toggled from the desktop shell/tray/global
  // shortcut) so the panel visibly signals when it won't accept clicks.
  const [clickThroughActive, setClickThroughActive] = useState(false);
  useDesktopClickThroughState(setClickThroughActive);

  const orderedQuestions = useMemo(() => [...props.questions].reverse(), [props.questions]);
  const manualResponses = useMemo(
    () => [...props.responses].filter((r) => r.questionId === null).reverse(),
    [props.responses]
  );

  if (!loaded) return null;

  if (prefs.collapsed) {
    // In presentation mode, the desktop shell (electron/main.js) already
    // moved/resized the actual OS window to the target corner/display —
    // the in-page position just needs to sit at the window's origin rather
    // than reapplying the (now-irrelevant) saved corner/custom position.
    // In a plain browser tab there's no OS window to move, so this still
    // anchors the compact pill predictably during a share.
    const collapsedStyle = prefs.presentationMode
      ? { position: "fixed" as const, top: clampCollapsedTop(8), left: 8 }
      : floatingContainerStyle({ ...prefs, collapsed: true });
    return (
      <CompactIndicator
        ref={panelRef as React.Ref<HTMLButtonElement>}
        status={props.status}
        responseCount={props.responses.length}
        onExpand={() => update({ collapsed: false })}
        style={collapsedStyle}
      />
    );
  }

  const fontSize = FONT_SIZE_PX[prefs.fontSize] ?? FONT_SIZE_PX.medium;
  const bodyPadding = prefs.density === "compact" ? "p-2.5" : "p-3.5";
  const bodyGap = prefs.density === "compact" ? "gap-2.5" : "gap-4";

  const contextQuestion = orderedQuestions[0];
  const showContextBar = !prefs.focusMode && contextQuestion && contextQuestion.id !== dismissedContextId;

  async function handleClearHistory() {
    if (!confirm("Clear this session's question and answer history? This can't be undone.")) return;
    try {
      await props.onClearHistory();
    } catch {
      // The page's own error surfaces are session-wide; a failed clear just
      // leaves the history in place, which is a safe fallback.
    }
  }

  function feedbackFor(id: string): "up" | "down" | null {
    return feedback[id] ?? null;
  }
  function setFeedbackFor(id: string, next: "up" | "down" | null) {
    setFeedback((f) => ({ ...f, [id]: next }));
  }

  return (
    // Three stacked glass layers (toolbar / context bar / main panel) rather
    // than one flat bordered box — this wrapper only carries position/size;
    // each child owns its own border/blur/shadow/background tier (see
    // .floating-layer and panelLayerBackground) so the group reads as
    // floating cards, per the RANA UI redesign.
    <div
      ref={panelRef as React.Ref<HTMLDivElement>}
      data-panel-theme={resolvedTheme}
      data-click-through={clickThroughActive || undefined}
      className="floating-panel floating-panel-enter fixed z-50 flex flex-col gap-2"
      style={{
        ...floatingContainerStyle(prefs),
        minWidth: FLOATING_MIN_WIDTH,
        minHeight: FLOATING_MIN_HEIGHT,
        maxWidth: FLOATING_MAX_WIDTH,
        maxHeight: FLOATING_MAX_HEIGHT,
      }}
    >
      <AssistantHeader
        mode={props.mode}
        status={props.status}
        contextCount={props.attachedContext.length}
        background={panelLayerBackground(resolvedTheme, prefs.opacity, "toolbar")}
        onDragPointerDown={drag.onPointerDown}
        onDragPointerMove={drag.onPointerMove}
        onDragPointerUp={drag.onPointerUp}
        onMinimize={() => update({ collapsed: true })}
        onToggleTranscript={() => update({ transcriptVisible: !prefs.transcriptVisible })}
        transcriptVisible={prefs.transcriptVisible}
        onToggleContext={() => setContextVisible((v) => !v)}
        onClearHistory={handleClearHistory}
        onTogglePause={props.onTogglePause}
        isPaused={props.isPaused}
        onEnd={props.onEnd}
        focusMode={prefs.focusMode}
        onToggleFocusMode={() => update({ focusMode: !prefs.focusMode })}
        onFocusAsk={() => runShortcutAction("focus-ask")}
        presentationActive={prefs.presentationMode}
        onTogglePresentation={togglePresentationMode}
        desktop={
          getDesktopShell()
            ? {
                alwaysOnTop: prefs.alwaysOnTop,
                onToggleAlwaysOnTop: () => {
                  const next = !prefs.alwaysOnTop;
                  update({ alwaysOnTop: next });
                  getDesktopShell()?.setAlwaysOnTop(next);
                },
                clickThroughActive,
                onToggleClickThrough: () => getDesktopShell()?.toggleClickThrough(),
                onMoveToSecondary: () => getDesktopShell()?.moveToSecondaryDisplay(),
              }
            : undefined
        }
      />

      {showContextBar && (
        <ContextBar
          question={contextQuestion.question}
          listening={props.status === "listening"}
          background={panelLayerBackground(resolvedTheme, prefs.opacity, "context")}
          onClear={() => setDismissedContextId(contextQuestion.id)}
          onExpand={() => update({ focusMode: true })}
        />
      )}

      <div
        className="floating-layer flex flex-1 flex-col overflow-hidden"
        style={{ backgroundColor: panelLayerBackground(resolvedTheme, prefs.opacity, "main") }}
      >
        {prefs.presentationMode && (
          <div className="flex items-center justify-between gap-2 border-b border-[var(--panel-border)] bg-accent/10 px-3 py-1.5">
            <span className="text-[0.75em] font-medium text-[var(--panel-fg)]">Presentation Mode active — stays compact automatically</span>
            <button
              type="button"
              onClick={togglePresentationMode}
              className="focus-ring shrink-0 rounded bg-accent px-2 py-1 text-[0.7em] font-medium text-accent-foreground hover:opacity-90"
            >
              Exit
            </button>
          </div>
        )}

        {props.micBanner}
        {props.errorBanner}

        {contextVisible && (
          <AddContextPanel attached={props.attachedContext} onAdd={props.onAddContext} onClose={() => setContextVisible(false)} />
        )}

        <TranscriptDrawer
          segments={props.segments}
          partialText={props.partialText}
          visible={prefs.transcriptVisible}
          speakerTag={props.speakerTag}
          onToggleSpeakerTag={props.onToggleSpeakerTag}
          onAskAbout={props.onAsk}
        />

        <div className={`flex-1 overflow-y-auto ${bodyPadding}`} style={{ fontSize }}>
          {props.aiThinking ? (
            <div className="flex flex-col gap-1.5">
              <StatusIndicator status="thinking" />
              <p className="text-[0.85em] text-[var(--panel-muted)]">Understanding the question…</p>
              {props.streamingText && (
                <p className="line-clamp-3 font-mono text-[0.7em] text-[var(--panel-muted)]">{props.streamingText}</p>
              )}
            </div>
          ) : prefs.focusMode ? (
            latestFeedItem ? (
              <div className="flex flex-col gap-2.5">
                {focusFeedItems.length > 1 && (
                  <div className="flex items-center justify-between text-[0.72em] text-[var(--panel-muted)]">
                    <button
                      type="button"
                      onClick={() => navigateFocus(-1)}
                      disabled={clampedFocusIndex === 0}
                      title="Previous answer (⌘←)"
                      aria-label="Previous answer"
                      className="focus-ring rounded px-1.5 py-0.5 font-mono hover:text-[var(--panel-fg)] disabled:opacity-30"
                    >
                      ⌘←
                    </button>
                    <span>
                      {clampedFocusIndex + 1} / {focusFeedItems.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigateFocus(1)}
                      disabled={clampedFocusIndex === focusFeedItems.length - 1}
                      title="Next answer (⌘→)"
                      aria-label="Next answer"
                      className="focus-ring rounded px-1.5 py-0.5 font-mono hover:text-[var(--panel-fg)] disabled:opacity-30"
                    >
                      ⌘→
                    </button>
                  </div>
                )}
                <ResponseCard
                  questionText={latestFeedItem.questionText}
                  payload={latestFeedItem.payload}
                  receivedAt={latestFeedItem.receivedAt}
                  onQuickAction={props.onAsk}
                  feedback={feedbackFor(latestFeedItem.id)}
                  onFeedback={(next) => setFeedbackFor(latestFeedItem.id, next)}
                />
              </div>
            ) : (
              <p className="text-[0.85em] text-[var(--panel-muted)]">Listening for relevant questions…</p>
            )
          ) : orderedQuestions.length === 0 && manualResponses.length === 0 ? (
            <p className="text-[0.85em] text-[var(--panel-muted)]">Listening for relevant questions…</p>
          ) : (
            <div className={`flex flex-col ${bodyGap}`}>
              {manualResponses.map((r) => (
                <div key={r.id} className="rounded-lg border border-accent/30 bg-[var(--panel-surface-2)] p-2.5">
                  <ResponseCard
                    badge={
                      <span className="inline-block w-fit rounded-full bg-accent/15 px-2 py-0.5 text-[0.65em] font-medium text-accent">
                        Ask AI
                      </span>
                    }
                    payload={r.payload}
                    receivedAt={r.receivedAt}
                    onQuickAction={props.onAsk}
                    feedback={feedbackFor(r.id)}
                    onFeedback={(next) => setFeedbackFor(r.id, next)}
                  />
                </div>
              ))}
              {orderedQuestions.map((q) => {
                const response = props.responses.find((r) => r.questionId === q.id);
                return (
                  <div key={q.id} className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-surface-2)] p-2.5">
                    {response ? (
                      <ResponseCard
                        badge={
                          <div className="flex items-center justify-between gap-2">
                            <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[0.65em] font-medium text-[var(--panel-muted)]">
                              {q.type}
                            </span>
                            <span className="text-[0.65em] text-[var(--panel-muted)]">{Math.round(q.confidence * 100)}%</span>
                          </div>
                        }
                        questionText={q.question}
                        payload={response.payload}
                        receivedAt={response.receivedAt}
                        onQuickAction={props.onAsk}
                        feedback={feedbackFor(response.id)}
                        onFeedback={(next) => setFeedbackFor(response.id, next)}
                      />
                    ) : (
                      <>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[0.65em] font-medium text-[var(--panel-muted)]">
                            {q.type}
                          </span>
                          <span className="text-[0.65em] text-[var(--panel-muted)]">{Math.round(q.confidence * 100)}%</span>
                        </div>
                        <p className="mb-1.5 text-[0.9em] font-medium text-[var(--panel-fg)]">{q.question}</p>
                        <p className="text-[0.8em] text-[var(--panel-muted)]">Waiting for answer…</p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!prefs.focusMode && <AskAIInput ref={askRef} onAsk={props.onAsk} />}

        <ResizeHandle onPointerDown={resize.onPointerDown} onPointerMove={resize.onPointerMove} onPointerUp={resize.onPointerUp} />
      </div>
    </div>
  );
}
