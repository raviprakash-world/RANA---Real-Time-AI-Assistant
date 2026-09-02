"use client";

import { useEffect, useReducer, useRef } from "react";
import { AIResponsePayload, QuestionType } from "@/lib/ai/schemas";

export interface LiveQuestion {
  id: string;
  type: QuestionType;
  confidence: number;
  question: string;
}

export interface LiveResponse {
  id: string;
  questionId: string | null;
  payload: AIResponsePayload;
  /** Client receive time (not server-generated-at) — good enough for the footer's "Answer · 10:03" timestamp. */
  receivedAt: number;
}

export interface LiveTranscriptSegment {
  id: string;
  speaker: string;
  text: string;
  startMs: number;
}

interface State {
  connection: "connecting" | "open" | "error";
  finalSegments: LiveTranscriptSegment[];
  partialText: string;
  partialSpeaker: string | null;
  questions: LiveQuestion[];
  aiThinking: boolean;
  streamingText: string;
  responses: LiveResponse[];
  errorMessage: string | null;
  sessionStatus: "ACTIVE" | "PAUSED" | "ENDED" | null;
  /** Bumped (to Date.now()) whenever a "history.cleared" event arrives — pages that also
   *  seed questions/responses from a REST fetch watch this to clear that seed too. */
  historyClearedAt: number | null;
}

type Action =
  | { type: "connection"; value: State["connection"] }
  | { type: "server-event"; event: MessageEventLike };

interface MessageEventLike {
  type: string;
  [key: string]: unknown;
}

const initialState: State = {
  connection: "connecting",
  finalSegments: [],
  partialText: "",
  partialSpeaker: null,
  questions: [],
  aiThinking: false,
  streamingText: "",
  responses: [],
  errorMessage: null,
  sessionStatus: null,
  historyClearedAt: null,
};

function reducer(state: State, action: Action): State {
  if (action.type === "connection") {
    return { ...state, connection: action.value };
  }

  const event = action.event;
  switch (event.type) {
    case "transcript.partial":
      return { ...state, partialText: event.text as string, partialSpeaker: event.speaker as string };
    case "transcript.final":
      return {
        ...state,
        partialText: "",
        partialSpeaker: null,
        finalSegments: [
          ...state.finalSegments,
          { id: event.segmentId as string, speaker: event.speaker as string, text: event.text as string, startMs: event.startMs as number },
        ],
      };
    case "question.detected":
      return {
        ...state,
        questions: [
          ...state.questions,
          { id: event.questionId as string, type: event.questionType as QuestionType, confidence: event.confidence as number, question: event.question as string },
        ],
      };
    case "ai.thinking":
      return { ...state, aiThinking: true, streamingText: "", errorMessage: null };
    case "ai.response.partial":
      return { ...state, streamingText: event.textSoFar as string };
    case "ai.response.complete":
      return {
        ...state,
        aiThinking: false,
        streamingText: "",
        responses: [
          ...state.responses,
          {
            id: event.responseId as string,
            questionId: event.questionId as string | null,
            payload: event.payload as AIResponsePayload,
            receivedAt: Date.now(),
          },
        ],
      };
    case "session.status":
      return { ...state, sessionStatus: event.status as State["sessionStatus"] };
    case "history.cleared":
      return { ...state, questions: [], responses: [], historyClearedAt: Date.now() };
    case "error":
      return { ...state, aiThinking: false, errorMessage: event.message as string };
    default:
      return state;
  }
}

export function useSessionEvents(sessionId: string) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const source = new EventSource(`/api/sessions/${sessionId}/events`);
    sourceRef.current = source;

    source.onopen = () => dispatch({ type: "connection", value: "open" });
    source.onerror = () => dispatch({ type: "connection", value: "error" });

    const eventTypes = [
      "transcript.partial",
      "transcript.final",
      "question.detected",
      "ai.thinking",
      "ai.response.partial",
      "ai.response.complete",
      "session.status",
      "history.cleared",
      "error",
    ];

    const handlers = eventTypes.map((type) => {
      const handler = (evt: MessageEvent) => {
        try {
          const parsed = JSON.parse(evt.data);
          dispatch({ type: "server-event", event: parsed });
        } catch {
          // ignore malformed frame
        }
      };
      source.addEventListener(type, handler);
      return { type, handler };
    });

    return () => {
      handlers.forEach(({ type, handler }) => source.removeEventListener(type, handler));
      source.close();
    };
  }, [sessionId]);

  return state;
}
