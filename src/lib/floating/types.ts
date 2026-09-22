export type CornerPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "custom";
export type Theme = "dark" | "light" | "system";
export type Density = "compact" | "comfortable";
export type FontSize = "small" | "medium" | "large";
export type PresentationDisplayChoice = "same" | "secondary" | "auto";

export interface FloatingUiPrefs {
  position: CornerPosition;
  /** Only meaningful when position === "custom" (set by dragging). Viewport pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0.5–1 */
  opacity: number;
  theme: Theme;
  density: Density;
  fontSize: FontSize;
  focusMode: boolean;
  transcriptVisible: boolean;
  autoHide: boolean;
  collapsed: boolean;
  /** Desktop-shell-only; no-op in a plain browser tab (see desktop-capabilities.ts). */
  alwaysOnTop: boolean;
  clickThrough: boolean;
  /**
   * Presentation Mode (screen-sharing-friendly): forces compact + focus so
   * the assistant never obstructs shared content. Deliberately does NOT
   * touch capture visibility — it's a normal window that just gets small
   * and (on desktop) can move to another display. See
   * FloatingAssistant.tsx's togglePresentationMode for the enter/exit flow.
   */
  presentationMode: boolean;
  presentationDisplay: PresentationDisplayChoice;
  /** Snapshot of the pre-presentation collapsed/focusMode, restored on exit. Null when not in presentation mode. */
  presentationSnapshot: { collapsed: boolean; focusMode: boolean } | null;
  /**
   * Scales text/icons/spacing/controls independently of the actual window
   * size (which stays whatever the user dragged it to) — a percentage,
   * HUD_SCALE_MIN–HUD_SCALE_MAX. 100 = no scaling. Applied via CSS `zoom`
   * on the panel content so every existing component scales proportionally
   * without each one needing scale-aware sizing logic.
   */
  hudScale: number;
}

export const FLOATING_MIN_WIDTH = 320;
export const FLOATING_MIN_HEIGHT = 180;
// A generous ceiling, not a product-chosen "that's big enough" cap — the
// real limit on desktop is the screen itself (see electron/main.js's
// createHudWindow, which bounds the actual OS window by the display's work
// area); in a browser tab the viewport-reflow effect in FloatingAssistant
// already clamps to window.innerWidth/innerHeight. This just keeps the
// panel from being dragged to something absurd like 10 screens wide.
export const FLOATING_MAX_WIDTH = 2400;
export const FLOATING_MAX_HEIGHT = 1600;
export const AUTO_HIDE_DELAY_MS = 8000;
export const CORNER_MARGIN = 16;
export const HUD_SCALE_MIN = 80;
export const HUD_SCALE_MAX = 140;
export const HUD_SCALE_DEFAULT = 100;

export const DEFAULT_FLOATING_UI_PREFS: FloatingUiPrefs = {
  position: "top-right",
  x: 0,
  y: 0,
  width: 1053,
  height: 512,
  opacity: 0.8,
  theme: "dark",
  density: "compact",
  fontSize: "medium",
  focusMode: false,
  transcriptVisible: false,
  autoHide: false,
  collapsed: false,
  alwaysOnTop: true,
  clickThrough: false,
  presentationMode: false,
  presentationDisplay: "secondary",
  presentationSnapshot: null,
  hudScale: HUD_SCALE_DEFAULT,
};

export function mergeFloatingUiPrefs(stored: unknown): FloatingUiPrefs {
  if (!stored || typeof stored !== "object") return { ...DEFAULT_FLOATING_UI_PREFS };
  return { ...DEFAULT_FLOATING_UI_PREFS, ...(stored as Partial<FloatingUiPrefs>) };
}
