"use client";

import { AIResponsePayload } from "@/lib/ai/schemas";
import { AssistantResponse } from "./AssistantResponse";
import { QuestionBlock, ResponseFooter } from "./responses/shared";

/**
 * One response, fully assembled: optional badge (type/confidence pill for
 * an auto-detected question, "Ask AI" for a manual one), the 💬 Question
 * block, the mode-specific answer view, and the timestamp/feedback footer
 * (reference sections 7–11) — the layout every render site in
 * FloatingAssistant.tsx shares, rather than duplicating question/footer
 * markup three times.
 */
export function ResponseCard({
  badge,
  questionText,
  payload,
  receivedAt,
  onQuickAction,
  feedback,
  onFeedback,
}: {
  badge?: React.ReactNode;
  questionText?: string;
  payload: AIResponsePayload;
  receivedAt: number;
  onQuickAction: (instruction: string) => void;
  feedback: "up" | "down" | null;
  onFeedback: (next: "up" | "down" | null) => void;
}) {
  return (
    <div className="response-enter @container flex flex-col gap-2.5">
      {badge}
      {questionText && <QuestionBlock text={questionText} />}
      <AssistantResponse payload={payload} questionText={questionText} onQuickAction={onQuickAction} />
      {/* Adaptive density: metadata (timestamp) and secondary actions
          (feedback) are the one thing safe to hide uniformly at very small
          sizes — unlike answer content (STAR sections, architecture, key
          points), which stays visible regardless of size since the answer
          itself must always stay readable. */}
      <div className="hidden @[360px]:block">
        <ResponseFooter receivedAt={receivedAt} feedback={feedback} onFeedback={onFeedback} />
      </div>
    </div>
  );
}
