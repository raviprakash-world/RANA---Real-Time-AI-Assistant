"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MicErrorKind } from "./useSpeechRecognition";

const CHUNK_DURATION_MS = 4000;
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

export interface UseCloudTranscriptionOptions {
  sessionId: string;
  speaker: "USER" | "INTERVIEWER" | "UNKNOWN";
}

export interface UseCloudTranscriptionResult {
  isSupported: boolean;
  isListening: boolean;
  error: { kind: MicErrorKind; message: string } | null;
  start: () => void;
  stop: () => void;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

/**
 * Server-side transcription path for contexts where the browser's free Web
 * Speech API doesn't work (see lib/ai/stt/types.ts) — records short audio
 * chunks locally and uploads each to /api/sessions/[id]/transcribe-chunk,
 * which transcribes it and feeds the result into the normal ingestion
 * pipeline server-side. The resulting transcript arrives back over the
 * session's existing SSE stream exactly like a Web-Speech-sourced segment
 * does, so this hook doesn't need onFinalResult/onPartialResult callbacks —
 * unlike useSpeechRecognition, there is no interim/partial text, since each
 * chunk only resolves once fully transcribed.
 */
export function useCloudTranscription(opts: UseCloudTranscriptionOptions): UseCloudTranscriptionResult {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<{ kind: MicErrorKind; message: string } | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  useEffect(() => {
    // Feature detection needs to run post-mount (SSR has no `window`).
    const supported = typeof window !== "undefined" && !!window.MediaRecorder && !!navigator.mediaDevices?.getUserMedia;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!supported) setIsSupported(false);
  }, []);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const shouldRecordRef = useRef(false);
  const startedAtRef = useRef(0);
  const mimeTypeRef = useRef("");

  const uploadChunk = useCallback((blob: Blob) => {
    const { sessionId, speaker } = optsRef.current;
    const elapsedMs = Date.now() - startedAtRef.current;
    const url = `/api/sessions/${sessionId}/transcribe-chunk?speaker=${speaker}&startMs=${elapsedMs}`;
    fetch(url, { method: "POST", headers: { "Content-Type": blob.type || "audio/webm" }, body: blob }).catch(() => {
      // One dropped chunk isn't fatal — the next chunk uploads independently.
      // Surfacing a blocking error here would interrupt the session over a
      // single transient network hiccup.
    });
  }, []);

  // Recursive "record one chunk, then record the next" loop. Held in a ref
  // (rather than having the callback below reference itself directly) so
  // the recursive continuation always calls the latest version — the same
  // "stable ref to latest function" pattern used for the desktop-shortcut
  // listeners in useDesktopShell.ts.
  const recordOneChunkRef = useRef<() => void>(() => {});

  const recordOneChunk = useCallback(() => {
    if (!shouldRecordRef.current || !streamRef.current) return;

    const recorder = new MediaRecorder(streamRef.current, mimeTypeRef.current ? { mimeType: mimeTypeRef.current } : undefined);
    const parts: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) parts.push(e.data);
    };
    recorder.onstop = () => {
      if (parts.length > 0) uploadChunk(new Blob(parts, { type: recorder.mimeType }));
      if (shouldRecordRef.current) recordOneChunkRef.current();
    };
    recorder.start();
    recorderRef.current = recorder;
    setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, CHUNK_DURATION_MS);
  }, [uploadChunk]);

  useEffect(() => {
    recordOneChunkRef.current = recordOneChunk;
  });

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mimeTypeRef.current = pickMimeType();
      shouldRecordRef.current = true;
      startedAtRef.current = Date.now();
      setIsListening(true);
      recordOneChunk();
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError({ kind: "permission-denied", message: "Microphone access was denied. Grant permission to use live transcription." });
      } else if (name === "NotFoundError") {
        setError({ kind: "no-mic", message: "No microphone was found. Connect a microphone and try again." });
      } else {
        setError({ kind: "unknown", message: "Couldn't start the microphone." });
      }
    }
  }, [recordOneChunk]);

  const stop = useCallback(() => {
    shouldRecordRef.current = false;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      shouldRecordRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { isSupported, isListening, error, start, stop };
}
