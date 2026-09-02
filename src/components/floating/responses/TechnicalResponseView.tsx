import { z } from "zod";
import { TechnicalAnswerSchema } from "@/lib/ai/schemas";
import { Section, BulletList, CopyIconButton } from "./shared";

export function TechnicalResponseView({ payload }: { payload: z.infer<typeof TechnicalAnswerSchema> }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <Section label="Answer" variant="primary">{payload.direct_answer}</Section>
        <CopyIconButton text={payload.direct_answer} />
      </div>
      <BulletList items={payload.key_points} />
      {payload.example && <Section label="Example">{payload.example}</Section>}
      {payload.tradeoffs.length > 0 && (
        <Section label="Tradeoffs">
          <BulletList items={payload.tradeoffs} />
        </Section>
      )}
      {payload.follow_up_questions.length > 0 && (
        <Section label="Follow-up">
          <BulletList items={payload.follow_up_questions} />
        </Section>
      )}
    </div>
  );
}
