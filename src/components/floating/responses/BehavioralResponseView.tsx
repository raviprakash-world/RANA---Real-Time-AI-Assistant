import { z } from "zod";
import { BehavioralAnswerSchema } from "@/lib/ai/schemas";
import { Section, BulletList } from "./shared";

export function BehavioralResponseView({ payload }: { payload: z.infer<typeof BehavioralAnswerSchema> }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        <Section label="Situation">{payload.situation}</Section>
        <Section label="Task">{payload.task}</Section>
        <Section label="Action">{payload.action}</Section>
        <Section label="Result">{payload.result}</Section>
      </div>
      <BulletList items={payload.key_points} />
      <Section label="Example answer" variant="primary">{payload.example_answer}</Section>
    </div>
  );
}
