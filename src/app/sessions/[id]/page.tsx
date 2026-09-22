"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, SessionDetail } from "@/lib/client/api";
import { useSessionEvents, LiveTranscriptSegment, LiveQuestion, LiveResponse } from "@/hooks/useSessionEvents";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useCloudTranscription } from "@/hooks/useCloudTranscription";
import { SessionSummaryView } from "@/components/session/SessionSummaryView";
import { AttachedContextItem } from "@/components/session/AddContextPanel";
import { AssistantStatus } from "@/components/StatusIndicator";
import { FloatingAssistant } from "@/components/floating/FloatingAssistant";
import { getDesktopShell } from "@/lib/floating/desktop-capabilities";

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [speakerTag, setSpeakerTag] = useState<"USER" | "UNKNOWN">("UNKNOWN");
  const [attachedContext, setAttachedContext] = useState<AttachedContextItem[]>([]);
  const [ending, setEnding] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);

  const live = useSessionEvents(sessionId);

  useEffect(() => {
    api
      .getSession(sessionId)
      .then((r) => {
        setSession(r.session);
        setAttachedContext(r.session.uploadedContext.map((u) => ({ id: u.id, kind: u.kind, filename: u.filename })));
      })
      .catch((e) => setLoadError(e.message));
  }, [sessionId]);

  // Tell the desktop shell (if any) that this session is the one to show in
  // the HUD window — no-op in a plain browser tab. See electron/main.js.
  useEffect(() => {
    getDesktopShell()?.notifySessionStarted(sessionId);
    return () => getDesktopShell()?.notifySessionEnded();
  }, [sessionId]);

  // A session can end through a channel other than this window's own End
  // button (another tab/window, the tray's End Session, the API directly) —
  // react to the SSE status change the same way handleEnd does, so the
  // summary view and the desktop shell both stay in sync regardless of how
  // it ended. The status flip is announced over SSE the moment the session
  // is marked ENDED, which can race ahead of summary generation (a separate,
  // slightly slower step) — poll briefly rather than fetching once and
  // possibly landing in the gap. Guarded by a ref (not `session.status` in
  // the deps) so the retry loop isn't torn down by its own setSession calls.
  const handledExternalEnd = useRef(false);
  useEffect(() => {
    if (live.sessionStatus !== "ENDED" || handledExternalEnd.current) return;
    handledExternalEnd.current = true;
    getDesktopShell()?.notifySessionEnded();

    let cancelled = false;
    let attempts = 0;
    const poll = () => {
      api
        .getSession(sessionId)
        .then((r) => {
          if (cancelled) return;
          setSession(r.session);
          attempts += 1;
          if (!r.session.summary && attempts < 5) setTimeout(poll, 1500);
        })
        .catch(() => {});
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [live.sessionStatus, sessionId]);

  const handleAddContext = useCallback(
    async (entry: { kind: "IDE" | "BROWSER" | "TERMINAL" | "SCREEN" | "OTHER"; label: string; text: string }) => {
      const result = await api.addContext(sessionId, entry);
      setAttachedContext((prev) => [...prev, result.context]);
    },
    [sessionId]
  );

  const handleFinal = useCallback(
    (text: string, startMs: number) => {
      api.sendTranscriptChunk(sessionId, { speaker: speakerTag, text, isFinal: true, startMs }).catch(() => {});
    },
    [sessionId, speakerTag]
  );
  const handlePartial = useCallback(
    (text: string) => {
      api.sendTranscriptChunk(sessionId, { speaker: speakerTag, text, isFinal: false, startMs: 0 }).catch(() => {});
    },
    [sessionId, speakerTag]
  );

  // The browser's free Web Speech API doesn't work inside the Electron HUD
  // (Google blocks its server-side recognition backend for non-Chrome
  // embedders — confirmed via macOS's own audio/TCC logs, not fixable from
  // either side). Both hooks are always called (rules of hooks — neither
  // does anything until .start()), and this just picks which one's result
  // the rest of the page treats as "the" mic. `useCloudDesktopSTT` is
  // resolved after mount (see effect below) so this doesn't depend on
  // window.desktopShell during the server-rendered/hydration pass.
  const [useCloudDesktopSTT, setUseCloudDesktopSTT] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUseCloudDesktopSTT(Boolean(getDesktopShell()));
  }, []);

  const webSpeech = useSpeechRecognition({ onFinalResult: handleFinal, onPartialResult: handlePartial });
  const cloudSpeech = useCloudTranscription({ sessionId, speaker: speakerTag });
  const speech = useCloudDesktopSTT ? cloudSpeech : webSpeech;

  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      if (next) {
        speech.stop();
        api.pauseSession(sessionId).catch(() => {});
      } else {
        speech.start();
        api.resumeSession(sessionId).catch(() => {});
      }
      return next;
    });
  }, [sessionId, speech]);

  // Keyboard shortcuts (Ask/Pause/Transcript/Show-hide/Escape) are handled
  // inside FloatingAssistant, since they now act on panel state (expand,
  // focus the ask box, toggle the transcript drawer) rather than page state.

  async function handleEnd() {
    setEnding(true);
    speech.stop();
    try {
      const result = await api.endSession(sessionId);
      setSession((prev) => (prev ? { ...prev, status: "ENDED", summary: result.summary as never } : prev));
      getDesktopShell()?.notifySessionEnded();
    } catch {
      setEnding(false);
    }
  }

  const handleAsk = useCallback(
    (instruction: string) => {
      api.askAI(sessionId, instruction).catch(() => {});
    },
    [sessionId]
  );

  // Capture happens client-side (Electron main process) before anything
  // reaches the server, so a failure here (no desktop shell, denied OS
  // permission) can't come back over SSE like every other error path — it
  // has to be surfaced locally.
  const handleScreenshot = useCallback(async () => {
    setScreenshotError(null);
    const shell = getDesktopShell();
    if (!shell) {
      setScreenshotError("Screenshot capture is only available in the desktop app.");
      return;
    }
    const result = await shell.captureScreenshot();
    if (!result.dataUrl) {
      setScreenshotError(result.error ?? "Screenshot capture failed.");
      return;
    }
    try {
      await api.askAboutScreenshot(sessionId, result.dataUrl);
    } catch (e) {
      setScreenshotError(e instanceof Error ? e.message : "Failed to send screenshot.");
    }
  }, [sessionId]);

  const handleClearHistory = useCallback(async () => {
    await api.clearHistory(sessionId);
    setSession((prev) => (prev ? { ...prev, questions: [], aiResponses: [] } : prev));
  }, [sessionId]);

  // Covers history cleared from elsewhere (another tab/window on the same
  // session, or the desktop HUD + launcher windows both open) — the REST-
  // fetched `session.questions`/`aiResponses` seed above only reacts to this
  // window's own handleClearHistory call, not a clear broadcast in over SSE.
  const clearedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (live.historyClearedAt === null || live.historyClearedAt === clearedAtRef.current) return;
    clearedAtRef.current = live.historyClearedAt;
    setSession((prev) => (prev ? { ...prev, questions: [], aiResponses: [] } : prev));
  }, [live.historyClearedAt]);

  const mergedSegments: LiveTranscriptSegment[] = useMemo(() => {
    const seed: LiveTranscriptSegment[] = (session?.transcriptSegments ?? [])
      .filter((s) => s.isFinal)
      .map((s) => ({ id: s.id, speaker: s.speaker, text: s.text, startMs: s.startMs }));
    const seen = new Set(seed.map((s) => s.id));
    const extra = live.finalSegments.filter((s) => !seen.has(s.id));
    return [...seed, ...extra];
  }, [session, live.finalSegments]);

  const mergedQuestions: LiveQuestion[] = useMemo(() => {
    const seed: LiveQuestion[] = (session?.questions ?? []).map((q) => ({
      id: q.id,
      type: q.type as LiveQuestion["type"],
      confidence: q.confidence,
      question: q.questionText,
    }));
    const seen = new Set(seed.map((q) => q.id));
    const extra = live.questions.filter((q) => !seen.has(q.id));
    return [...seed, ...extra];
  }, [session, live.questions]);

  const mergedResponses: LiveResponse[] = useMemo(() => {
    const seed: LiveResponse[] = (session?.aiResponses ?? []).map((r) => ({
      id: r.id,
      questionId: r.questionId,
      payload: r.payload as never,
      receivedAt: new Date(r.createdAt).getTime(),
    }));
    const seen = new Set(seed.map((r) => r.id));
    const extra = live.responses.filter((r) => !seen.has(r.id));
    return [...seed, ...extra];
  }, [session, live.responses]);

  if (loadError) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center">
        <p className="text-danger">{loadError}</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center text-sm text-muted">Loading session…</main>
    );
  }

  if (session.status === "ENDED" && session.summary) {
    return <SessionSummaryView summary={session.summary} sessionId={sessionId} />;
  }

  if (session.status === "ENDED" && !session.summary) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center text-sm text-muted">
        {ending ? "Generating summary…" : "This session has ended."}
      </main>
    );
  }

  // A single unified status drives the floating header's one status dot
  // (the compact panel shows one line, not separate mic/AI indicators —
  // see StatusIndicator's "disconnected" variant for the SSE-drop case).
  const status: AssistantStatus = speech.error
    ? "error"
    : live.errorMessage
    ? "error"
    : live.connection === "error"
    ? "disconnected"
    : isPaused
    ? "paused"
    : live.aiThinking
    ? "thinking"
    : speech.isListening
    ? "listening"
    : mergedResponses.length > 0
    ? "ready"
    : "idle";

  const micBanner =
    !speech.isListening && !isPaused ? (
      <div className="flex items-center justify-between gap-2 border-b border-[var(--panel-border)] bg-accent/10 px-3 py-1.5 text-[11px]">
        <span className="text-[var(--panel-fg)]">
          {speech.isSupported ? "Microphone is off." : "This browser doesn't support live transcription."}
        </span>
        {speech.isSupported && (
          <button
            type="button"
            onClick={speech.start}
            className="focus-ring shrink-0 rounded bg-accent px-2 py-1 text-[11px] font-medium text-accent-foreground hover:opacity-90"
          >
            Enable Mic
          </button>
        )}
      </div>
    ) : null;

  const errorText = speech.error?.message || live.errorMessage || screenshotError;
  const errorBanner = errorText ? (
    <div className="border-b border-[var(--panel-border)] bg-danger/15 px-3 py-1.5 text-[11px] text-danger">{errorText}</div>
  ) : null;

  return (
    <div className="relative flex-1">
      <FloatingAssistant
        mode={session.mode}
        status={status}
        aiThinking={live.aiThinking}
        streamingText={live.streamingText}
        questions={mergedQuestions}
        responses={mergedResponses}
        segments={mergedSegments}
        partialText={live.partialText}
        isPaused={isPaused}
        onTogglePause={togglePause}
        onEnd={handleEnd}
        onAsk={handleAsk}
        onScreenshot={handleScreenshot}
        onClearHistory={handleClearHistory}
        attachedContext={attachedContext}
        onAddContext={handleAddContext}
        speakerTag={speakerTag}
        onToggleSpeakerTag={() => setSpeakerTag((t) => (t === "USER" ? "UNKNOWN" : "USER"))}
        micBanner={micBanner}
        errorBanner={errorBanner}
      />
    </div>
  );
}
