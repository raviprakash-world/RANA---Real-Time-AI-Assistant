import { z } from "zod";
import { SystemDesignAnswerSchema } from "@/lib/ai/schemas";
import { Section, BulletList } from "./shared";

/**
 * Renders `components` as a simple top-to-bottom text flow (Client → API
 * Gateway → … → Database), the compact stand-in for an architecture
 * diagram. Deliberately a standalone component with a narrow contract
 * (just a string[]) so a real SVG/canvas diagram renderer can replace its
 * insides later without anything else in the response view changing.
 */
function ArchitectureFlow({ steps }: { steps: string[] }) {
  if (steps.length === 0) return null;
  return (
    <div className="flex flex-col items-start gap-0.5 font-mono text-[11px]">
      {steps.map((step, i) => (
        <div key={i} className="flex flex-col items-start">
          <span className="rounded border border-[var(--panel-border)] bg-[var(--panel-surface-2)] px-2 py-1 text-[var(--panel-fg)]">
            {step}
          </span>
          {i < steps.length - 1 && <span className="pl-2 text-[var(--panel-muted)]">↓</span>}
        </div>
      ))}
    </div>
  );
}

export function SystemDesignResponseView({ payload }: { payload: z.infer<typeof SystemDesignAnswerSchema> }) {
  return (
    <div className="flex flex-col gap-2.5">
      {payload.requirements.length > 0 && (
        <Section label="Requirements">
          <BulletList items={payload.requirements} />
        </Section>
      )}
      <Section label="Architecture" variant="primary">{payload.architecture}</Section>
      <ArchitectureFlow steps={payload.components} />
      {payload.data_flow && <Section label="Data flow">{payload.data_flow}</Section>}
      {payload.apis.length > 0 && (
        <Section label="APIs">
          <BulletList items={payload.apis} />
        </Section>
      )}
      {payload.database && <Section label="Database">{payload.database}</Section>}
      {payload.scaling && <Section label="Scaling">{payload.scaling}</Section>}
      {payload.caching && <Section label="Caching">{payload.caching}</Section>}
      {payload.failure_handling && <Section label="Failure handling">{payload.failure_handling}</Section>}
      {payload.tradeoffs.length > 0 && (
        <Section label="Tradeoffs">
          <BulletList items={payload.tradeoffs} />
        </Section>
      )}
    </div>
  );
}
