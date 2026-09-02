export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `Request failed (${res.status})`, res.status);
  }
  return res.json();
}

export const api = {
  status: () => request<{ llmProvider: string; isMock: boolean }>("/api/status"),

  /**
   * Extracts text from a PDF or Word (.docx) file server-side. Bypasses the
   * `request` helper above since a FormData body needs the browser to set
   * its own multipart Content-Type (with boundary) — forcing
   * application/json, as `request` does for every other call, would break
   * the upload.
   */
  parseFile: async (file: File): Promise<{ filename: string; text: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/parse-file", { method: "POST", body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error || `Request failed (${res.status})`, res.status);
    }
    return res.json();
  },

  listSessions: () => request<{ sessions: SessionListItem[] }>("/api/sessions"),
  getSession: (id: string) => request<{ session: SessionDetail }>(`/api/sessions/${id}`),
  createSession: (input: CreateSessionInput) =>
    request<{ session: SessionDetail }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteSession: (id: string) => request<{ ok: true }>(`/api/sessions/${id}`, { method: "DELETE" }),
  pauseSession: (id: string) => request(`/api/sessions/${id}/pause`, { method: "POST" }),
  resumeSession: (id: string) => request(`/api/sessions/${id}/resume`, { method: "POST" }),
  endSession: (id: string) =>
    request<{ session: SessionDetail; summary: SessionSummaryDTO }>(`/api/sessions/${id}/end`, { method: "POST" }),
  clearHistory: (id: string) => request<{ ok: true }>(`/api/sessions/${id}/history`, { method: "DELETE" }),

  sendTranscriptChunk: (
    id: string,
    chunk: { speaker: "INTERVIEWER" | "USER" | "UNKNOWN"; text: string; isFinal: boolean; startMs: number; endMs?: number }
  ) =>
    request(`/api/sessions/${id}/transcript`, {
      method: "POST",
      body: JSON.stringify(chunk),
    }),

  addContext: (id: string, entry: { kind: "IDE" | "BROWSER" | "TERMINAL" | "SCREEN" | "OTHER"; label: string; text: string }) =>
    request<{ context: { id: string; kind: string; filename: string } }>(`/api/sessions/${id}/context`, {
      method: "POST",
      body: JSON.stringify(entry),
    }),

  askAI: (id: string, instruction: string) =>
    request(`/api/sessions/${id}/ask`, { method: "POST", body: JSON.stringify({ instruction }) }),

  getPreferences: () => request<{ preference: UserPreference }>("/api/preferences"),
  updatePreferences: (patch: Partial<UserPreference>) =>
    request<{ preference: UserPreference }>("/api/preferences", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
};

export interface CreateSessionInput {
  mode: "INTERVIEW" | "CODING" | "SYSTEM_DESIGN" | "MEETING" | "CUSTOM";
  role?: string;
  experience?: string;
  context?: string;
  additionalInstructions?: string;
  uploadedContext?: { kind: "RESUME" | "JOB_DESCRIPTION" | "OTHER"; filename: string; text: string }[];
}

export interface SessionListItem {
  id: string;
  mode: string;
  role: string | null;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  createdAt: string;
  _count: { questions: number; transcriptSegments: number };
  summary: { topics: unknown[] } | null;
}

export interface SessionDetail extends SessionListItem {
  context: string | null;
  experience: string | null;
  additionalInstructions: string | null;
  rollingSummary: string | null;
  detectedTechnologies: string[];
  transcriptSegments: TranscriptSegmentDTO[];
  questions: QuestionDTO[];
  aiResponses: AIResponseDTO[];
  summary: SessionSummaryDTO | null;
  uploadedContext: { id: string; kind: string; filename: string; text: string }[];
}

export interface TranscriptSegmentDTO {
  id: string;
  speaker: "INTERVIEWER" | "USER" | "UNKNOWN";
  text: string;
  isFinal: boolean;
  startMs: number;
  createdAt: string;
}

export interface QuestionDTO {
  id: string;
  type: string;
  confidence: number;
  questionText: string;
  createdAt: string;
  responses: AIResponseDTO[];
}

export interface AIResponseDTO {
  id: string;
  questionId: string | null;
  type: string;
  payload: Record<string, unknown>;
  latencyMs: number | null;
  createdAt: string;
}

export interface SessionSummaryDTO {
  topics: string[];
  questionsAsked: { question: string; type: string }[];
  strengths: string[];
  weaknesses: string[];
  actionItems: string[];
  rawSummary: string;
}

export interface UserPreference {
  autoAnswer: boolean;
  temperature: number;
  maxTokens: number;
  language: string;
  retentionDays: number;
  llmProvider: string;
  llmModel: string;
  floatingUi: Record<string, unknown>;
}
