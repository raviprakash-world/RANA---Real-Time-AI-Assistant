import { z } from "zod";
import { ManualAnswerSchema } from "@/lib/ai/schemas";
import { Section, BulletList, CopyIconButton } from "./shared";

export function ManualResponseView({ payload }: { payload: z.infer<typeof ManualAnswerSchema> }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <Section label="Answer" variant="primary">{payload.answer}</Section>
        <CopyIconButton text={payload.answer} />
      </div>
      <BulletList items={payload.key_points} />
    </div>
  );
}
