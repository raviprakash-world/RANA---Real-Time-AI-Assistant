import { prisma } from "@/lib/db/prisma";
import { getLLMProvider } from "@/lib/ai/llm";
import { summaryTaskPrompt } from "@/lib/ai/prompts/tasks/summary.prompt";
import { SessionSummarySchema, parseAndValidate } from "@/lib/ai/schemas";
import { logger, LogEvent } from "@/lib/observability/logger";

export async function generateSessionSummary(sessionId: string) {
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      transcriptSegments: { orderBy: { createdAt: "asc" } },
      questions: { include: { responses: true }, orderBy: { createdAt: "asc" } },
    },
  });

  const fullTranscript = session.transcriptSegments.map((s) => `${s.speaker}: ${s.text}`).join("\n") || "(no transcript captured)";

  const questionsAndAnswers =
    session.questions
      .map((q) => {
        const answer = q.responses[0]?.payload;
        return `Q [${q.type}, confidence ${q.confidence.toFixed(2)}]: ${q.questionText}\nA: ${answer ? JSON.stringify(answer) : "(no answer generated)"}`;
      })
      .join("\n\n") || "(no questions detected)";

  const provider = getLLMProvider();
  const raw = await provider.generate(
    [
      {
        role: "system",
        content: "You produce honest, specific post-session performance summaries for interview/meeting assistants.",
      },
      { role: "user", content: summaryTaskPrompt({ fullTranscript, questionsAndAnswers }) },
    ],
    { jsonMode: true, temperature: 0.3, maxTokens: 900, taskHint: "summary" }
  );

  const parsed = parseAndValidate(raw, SessionSummarySchema);
  if (!parsed.ok) {
    logger.error(LogEvent.AIResponseParseFailed, { sessionId, stage: "summary", reason: parsed.error.slice(0, 200) });
  }
  const data = parsed.ok
    ? parsed.data
    : {
        topics: [],
        questions_asked: [],
        strengths: [],
        weaknesses: [],
        action_items: [],
        raw_summary: "Summary generation failed; the transcript and questions are still saved.",
      };

  const summary = await prisma.sessionSummary.upsert({
    where: { sessionId },
    create: {
      sessionId,
      topics: data.topics,
      questionsAsked: data.questions_asked,
      strengths: data.strengths,
      weaknesses: data.weaknesses,
      actionItems: data.action_items,
      rawSummary: data.raw_summary,
    },
    update: {
      topics: data.topics,
      questionsAsked: data.questions_asked,
      strengths: data.strengths,
      weaknesses: data.weaknesses,
      actionItems: data.action_items,
      rawSummary: data.raw_summary,
    },
  });

  logger.info(LogEvent.SummaryGenerated, { sessionId, topicsCount: data.topics.length, questionsCount: data.questions_asked.length });
  return summary;
}
