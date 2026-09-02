import { z } from "zod";
import { CodingAnswerSchema } from "@/lib/ai/schemas";
import { Section, BulletList, CopyIconButton } from "./shared";
import { CodeBlock } from "../CodeBlock";

const QUICK_ACTIONS = ["Explain", "Hint", "Solution", "Optimize", "Debug"];

export function CodingResponseView({
  payload,
  problemContext,
  onQuickAction,
}: {
  payload: z.infer<typeof CodingAnswerSchema>;
  problemContext: string;
  onQuickAction: (instruction: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <Section label="Approach" variant="primary">{payload.approach}</Section>
      <div className="flex gap-4 text-[11px] text-[var(--panel-muted)]">
        <span>
          Time: <span className="text-[var(--panel-fg)]">{payload.complexity.time}</span>
        </span>
        <span>
          Space: <span className="text-[var(--panel-fg)]">{payload.complexity.space}</span>
        </span>
      </div>
      <div>
        <div className="mb-0.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">Code</span>
          <CopyIconButton text={payload.code} />
        </div>
        <CodeBlock code={payload.code} />
      </div>
      {payload.edge_cases.length > 0 && (
        <Section label="Edge cases">
          <BulletList items={payload.edge_cases} />
        </Section>
      )}
      {payload.explanation && <Section label="Explanation">{payload.explanation}</Section>}

      <div className="flex flex-wrap gap-1 border-t border-[var(--panel-border)] pt-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() =>
              onQuickAction(`For the coding problem "${problemContext}", give me: ${action}. Keep it focused on just that.`)
            }
            className="focus-ring rounded border border-[var(--panel-border)] px-1.5 py-0.5 text-[11px] text-[var(--panel-muted)] hover:text-[var(--panel-fg)]"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}
