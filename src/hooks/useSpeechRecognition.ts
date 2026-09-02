"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MicErrorKind = "not-supported" | "permission-denied" | "no-mic" | "network" | "unknown" | "retry-limit";

export interface UseSpeechRecognitionOptions {
  lang?: string;
  onFinalResult: (text: string, startMs: number) => void;
  onPartialResult: (text: string) => void;
}

export interface UseSpeechRecognitionResult {
  isSupported: boolean;
  isListening: boolean;
  error: { kind: MicErrorKind; message: string } | null;
  start: () => void;
  stop: () => void;
}

// If a recognition session ends this soon after starting, with no result in
// between, that's not Chrome's normal ~60s continuous-session timeout —
// it's a real failure (most commonly: the OS denied microphone access to
// this specific process, which the Web Speech API surfaces as an
// immediate end rather than a clean "not-allowed" error in some embedders).
const QUICK_FAIL_THRESHOLD_MS = 1500;
const MAX_CONSECUTIVE_QUICK_FAILS = 3;
const RETRY_DELAY_MS = 300;

/**
 * Wraps the browser Web Speech API (SpeechRecognition) for continuous,
 * streaming transcription. Chrome silently ends recognition sessions after
 * periods of silence / ~60s — this hook auto-restarts as long as the user
 * hasn't explicitly stopped, so "continuous listening" actually stays
 * continuous from the user's perspective.
 *
 * The restart is deliberately bounded (see QUICK_FAIL_THRESHOLD_MS /
 * MAX_CONSECUTIVE_QUICK_FAILS): a real bug here previously retried
 * immediately and unconditionally forever, which turned a one-time
 * OS-level microphone permission failure (confirmed live, in the Electron
 * desktop shell — an unpackaged `electron .` process not yet granted mic
 * access in System Settings) into a tight infinite retry loop.
 */
export function useSpeechRecognition(opts: UseSpeechRecognitionOptions): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<{ kind: MicErrorKind; message: string } | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldBeListeningRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const attemptStartedAtRef = useRef<number>(0);
  const consecutiveQuickFailsRef = useRef(0);
  const optsRef = useRef(opts);

  useEffect(() => {
    optsRef.current = opts;
  });

  useEffect(() => {
    // Browser feature detection must happen post-mount (SSR has no `window`),
    // so this genuinely needs an effect rather than a render-time check.
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!Ctor) setIsSupported(false);
  }, []);

  const buildRecognition = useCallback((): SpeechRecognitionLike | null => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return null;

    const recognition = new Ctor();
    recognition.lang = optsRef.current.lang || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      // Definitive proof the connection is healthy — clear any stale
      // "retrying…"/unknown error and reset the failure-streak counter.
      // Without the error clear, setError(null) only ever ran inside
      // start(), so an error from an auto-restart (recognition.start()
      // called directly in onend, not through start()) stayed on screen
      // forever even after transcription silently resumed working.
      consecutiveQuickFailsRef.current = 0;
      setError((prev) => (prev && (prev.kind === "network" || prev.kind === "unknown") ? null : prev));

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (!transcript.trim()) continue;
        if (result.isFinal) {
          optsRef.current.onFinalResult(transcript.trim(), Date.now() - startTimeRef.current);
        } else {
          optsRef.current.onPartialResult(transcript.trim());
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") return; // benign, keep going
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        shouldBeListeningRef.current = false;
        setError({ kind: "permission-denied", message: "Microphone access was denied. Grant permission to use live transcription." });
        setIsListening(false);
        return;
      }
      if (event.error === "audio-capture") {
        shouldBeListeningRef.current = false;
        setError({ kind: "no-mic", message: "No microphone was found. Connect a microphone and try again." });
        setIsListening(false);
        return;
      }
      if (event.error === "network") {
        setError({ kind: "network", message: "Network interruption during transcription — retrying…" });
        return;
      }
      setError({ kind: "unknown", message: `Transcription error: ${event.error}` });
    };

    recognition.onend = () => {
      if (!shouldBeListeningRef.current) {
        setIsListening(false);
        return;
      }

      const elapsed = Date.now() - attemptStartedAtRef.current;
      consecutiveQuickFailsRef.current = elapsed < QUICK_FAIL_THRESHOLD_MS ? consecutiveQuickFailsRef.current + 1 : 0;

      if (consecutiveQuickFailsRef.current >= MAX_CONSECUTIVE_QUICK_FAILS) {
        shouldBeListeningRef.current = false;
        setIsListening(false);
        setError({
          kind: "retry-limit",
          message:
            "Microphone keeps failing to start and stopped retrying. If you're using the desktop app, grant it microphone access in System Settings → Privacy & Security → Microphone, then restart the app.",
        });
        return;
      }

      // Chrome ends the session periodically even while "continuous" —
      // transparently restart so the user experience stays uninterrupted.
      // Always via a short delay (not synchronously): a same-tick restart
      // is exactly what turned a persistent failure into a tight loop.
      setTimeout(() => {
        if (!shouldBeListeningRef.current) return;
        try {
          attemptStartedAtRef.current = Date.now();
          recognition.start();
          // A fresh attempt is now in flight — drop a stale "retrying…"
          // banner immediately rather than leaving it up until the user's
          // next utterance produces a result. onerror re-sets it right
          // away if this attempt fails too.
          setError((prev) => (prev && (prev.kind === "network" || prev.kind === "unknown") ? null : prev));
        } catch {
          // give up silently for this cycle; onend will fire again if the
          // browser considers this attempt over, re-entering this same path
        }
      }, RETRY_DELAY_MS);
    };

    return recognition;
  }, []);

  const start = useCallback(() => {
    setError(null);
    consecutiveQuickFailsRef.current = 0;
    const recognition = buildRecognition();
    if (!recognition) {
      setError({ kind: "not-supported", message: "This browser doesn't support live speech recognition. Try Chrome." });
      return;
    }
    recognitionRef.current = recognition;
    shouldBeListeningRef.current = true;
    startTimeRef.current = Date.now();
    attemptStartedAtRef.current = Date.now();
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setError({ kind: "unknown", message: "Couldn't start the microphone." });
    }
  }, [buildRecognition]);

  const stop = useCallback(() => {
    shouldBeListeningRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      shouldBeListeningRef.current = false;
      recognitionRef.current?.abort();
    };
  }, []);

  return { isSupported, isListening, error, start, stop };
}
