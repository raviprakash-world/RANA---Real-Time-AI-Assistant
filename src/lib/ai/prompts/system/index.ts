import { PromptContext } from "../types";
import { interviewSystemPrompt } from "./interview.prompt";
import { codingSystemPrompt } from "./coding.prompt";
import { systemDesignSystemPrompt } from "./system-design.prompt";
import { meetingSystemPrompt } from "./meeting.prompt";
import { customSystemPrompt } from "./custom.prompt";

export function getSystemPrompt(ctx: PromptContext): string {
  switch (ctx.mode) {
    case "INTERVIEW":
      return interviewSystemPrompt(ctx);
    case "CODING":
      return codingSystemPrompt(ctx);
    case "SYSTEM_DESIGN":
      return systemDesignSystemPrompt(ctx);
    case "MEETING":
      return meetingSystemPrompt(ctx);
    case "CUSTOM":
      return customSystemPrompt(ctx);
    default:
      return interviewSystemPrompt(ctx);
  }
}
