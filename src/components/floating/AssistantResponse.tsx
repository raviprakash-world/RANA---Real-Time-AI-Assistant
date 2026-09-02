import { AIResponsePayload } from "@/lib/ai/schemas";
import { TechnicalResponseView } from "./responses/TechnicalResponseView";
import { CodingResponseView } from "./responses/CodingResponseView";
import { SystemDesignResponseView } from "./responses/SystemDesignResponseView";
import { BehavioralResponseView } from "./responses/BehavioralResponseView";
import { MeetingInsightView } from "./responses/MeetingInsightView";
import { ManualResponseView } from "./responses/ManualResponseView";

/**
 * Dispatches to a mode-specific renderer by payload type, per the
 * `<AssistantResponse mode={...} response={...} />` shape called for in the
 * UI spec — each mode gets its own component (section 26) rather than one
 * giant switch-everything component.
 */
export function AssistantResponse({
  payload,
  questionText,
  onQuickAction,
}: {
  payload: AIResponsePayload;
  questionText?: string;
  onQuickAction: (instruction: string) => void;
}) {
  switch (payload.type) {
    case "technical_answer":
      return <TechnicalResponseView payload={payload} />;
    case "coding_answer":
      return <CodingResponseView payload={payload} problemContext={questionText ?? payload.problem} onQuickAction={onQuickAction} />;
    case "system_design_answer":
      return <SystemDesignResponseView payload={payload} />;
    case "behavioral_answer":
      return <BehavioralResponseView payload={payload} />;
    case "meeting_notes":
      return <MeetingInsightView payload={payload} />;
    case "manual":
      return <ManualResponseView payload={payload} />;
    default:
      return null;
  }
}
