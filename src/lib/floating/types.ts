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
}

export const FLOATING_MIN_WIDTH = 320;
export const FLOATING_MIN_HEIGHT = 180;
export const FLOATING_MAX_WIDTH = 900;
export const FLOATING_MAX_HEIGHT = 800;
export const AUTO_HIDE_DELAY_MS = 8000;
export const CORNER_MARGIN = 16;

export const DEFAULT_FLOATING_UI_PREFS: FloatingUiPrefs = {
  position: "top-right",
  x: 0,
  y: 0,
  width: 760,
  height: 600,
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
};

export function mergeFloatingUiPrefs(stored: unknown): FloatingUiPrefs {
  if (!stored || typeof stored !== "object") return { ...DEFAULT_FLOATING_UI_PREFS };
  return { ...DEFAULT_FLOATING_UI_PREFS, ...(stored as Partial<FloatingUiPrefs>) };
}
