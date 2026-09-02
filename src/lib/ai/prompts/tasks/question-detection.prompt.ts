export function questionDetectionTaskPrompt(transcriptChunk: string): string {
  return `Classify the following piece of a live conversation transcript.

Transcript chunk:
"""
${transcriptChunk}
"""

Decide whether this chunk contains something the assistant should react to right now.

Return ONLY a JSON object with this exact shape:
{
  "type": "TECHNICAL" | "CODING" | "SYSTEM_DESIGN" | "BEHAVIORAL" | "CLARIFICATION" | "FOLLOW_UP" | "MEETING_TOPIC" | "NO_ACTION",
  "confidence": number between 0 and 1,
  "question": "the core question or topic, restated in one sentence"
}

Guidance:
- Use NO_ACTION for small talk, filler, incomplete thoughts, or anything that doesn't need a response.
- Use CODING for algorithm/data-structure/debugging/SQL/API-implementation questions.
- Use SYSTEM_DESIGN for architecture/scalability questions.
- Use BEHAVIORAL for "tell me about a time...", conflict, leadership, teamwork questions.
- Use MEETING_TOPIC for a decision, action item, risk, or open question raised in a meeting.
- Use TECHNICAL for general technical questions that aren't coding or system design.
- Be conservative: only report high confidence (>0.7) when the chunk is clearly a complete
  thought worth reacting to.`;
}
