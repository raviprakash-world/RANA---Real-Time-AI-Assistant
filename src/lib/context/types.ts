/**
 * Modular context-provider interface (MASTER BUILD PROMPT section 7).
 *
 * The AI reasoning pipeline must never be tightly coupled to one specific
 * way of capturing "what's on screen" — an IDE, a browser tab, a terminal,
 * or a raw screen/OCR capture are all just different sources feeding the
 * same context engine. Any of them can be implemented later purely by
 * writing a class that satisfies `ContextProvider` below; nothing in
 * `context-engine.ts` or the AI layer needs to change.
 *
 * Today only a manual "paste context" provider is wired up end to end
 * (src/app/api/sessions/[id]/context/route.ts) — a user pastes code or
 * screen text themselves. `MockScreenProvider` demonstrates the shape an
 * automated capture provider (IDE extension, browser extension, screen OCR)
 * would take, mirroring how `lib/ai/llm/mock-provider.ts` stands in for a
 * real LLM provider.
 */

export type ContextSourceKind = "IDE" | "BROWSER" | "TERMINAL" | "SCREEN" | "OTHER";

export interface ContextSnapshot {
  kind: ContextSourceKind;
  /** Short human-readable label — filename, window/tab title, etc. */
  label: string;
  content: string;
  capturedAt: Date;
}

export interface ContextProvider {
  readonly id: string;
  readonly kind: ContextSourceKind;
  /**
   * Pulls the current state from the source. Returns null when there's
   * nothing new/available — callers should not treat that as an error.
   */
  capture(): Promise<ContextSnapshot | null>;
}
