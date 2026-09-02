import { z } from "zod";
import { MeetingNotesSchema } from "@/lib/ai/schemas";
import { Section, BulletList } from "./shared";

export function MeetingInsightView({ payload }: { payload: z.infer<typeof MeetingNotesSchema> }) {
  return (
    <div className="flex flex-col gap-2.5">
      {payload.decisions.length > 0 && (
        <Section label="Decision">
          <BulletList items={payload.decisions} />
        </Section>
      )}
      {payload.action_items.length > 0 && (
        <Section label="Action items">
          <BulletList items={payload.action_items} />
        </Section>
      )}
      {payload.key_points.length > 0 && (
        <Section label="Key points">
          <BulletList items={payload.key_points} />
        </Section>
      )}
      {payload.risks.length > 0 && (
        <Section label="Risks">
          <BulletList items={payload.risks} />
        </Section>
      )}
      {payload.questions_to_ask.length > 0 && (
        <Section label="Questions to ask">
          <BulletList items={payload.questions_to_ask} />
        </Section>
      )}
    </div>
  );
}
