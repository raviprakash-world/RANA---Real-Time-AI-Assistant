export function summaryTaskPrompt(params: {
  fullTranscript: string;
  questionsAndAnswers: string;
}): string {
  return `The session has ended. Below is the transcript and the questions/answers generated
during the session. Produce a session summary.

Transcript:
"""
${params.fullTranscript}
"""

Questions detected and answers given:
"""
${params.questionsAndAnswers}
"""

Return ONLY a JSON object with exactly this shape:
{
  "topics": ["topic discussed", "..."],
  "questions_asked": [{ "question": "...", "type": "TECHNICAL|CODING|SYSTEM_DESIGN|BEHAVIORAL|MEETING_TOPIC" }],
  "strengths": ["area the user handled well", "..."],
  "weaknesses": ["area needing improvement", "..."],
  "action_items": ["concrete thing to study/practice/follow up on", "..."],
  "raw_summary": "3-6 sentence plain-language summary of the whole session"
}

Be honest and specific. Base strengths/weaknesses only on what's evidenced in the
transcript — do not invent performance details you cannot support.`;
}
