import { CSSProperties } from "react";
import { CORNER_MARGIN, FloatingUiPrefs } from "./types";

/**
 * Background color for one layer of the glass stack (toolbar / context bar
 * / main panel). Each tier nudges the user's chosen opacity slightly —
 * toolbar darkest, context bar most transparent, main panel most opaque —
 * so the three read as distinct floating surfaces rather than one flat
 * panel with internal dividers (see the RANA UI redesign's layered-window
 * requirement). Clamped to [0.5, 0.97] to stay within the app's supported
 * opacity range regardless of the tier's offset.
 */
const LAYER_ALPHA_OFFSET = { toolbar: 0.04, context: -0.06, main: 0.02 } as const;

export function panelLayerBackground(theme: "dark" | "light", opacity: number, layer: keyof typeof LAYER_ALPHA_OFFSET): string {
  const alpha = Math.min(0.97, Math.max(0.5, opacity + LAYER_ALPHA_OFFSET[layer]));
  return theme === "light" ? `rgba(245, 246, 249, ${alpha})` : `rgba(14, 15, 19, ${alpha})`;
}

// The app's own nav bar (h-14). Only relevant in a normal browser tab —
// the Electron shell (see electron/preload.js) has no nav to collide with.
const NAV_HEIGHT_PX = 56;

function isDesktopShell(): boolean {
  return typeof window !== "undefined" && Boolean((window as unknown as { desktopShell?: { isDesktop?: boolean } }).desktopShell?.isDesktop);
}

/**
 * The collapsed pill is small enough that a `top` near 0 can end up mostly
 * hidden behind the app's sticky nav bar. Only the *collapsed* state gets
 * clamped — the full panel is large/interactive enough that a slight
 * overlap while dragging is a non-issue (and desirable: it's meant to
 * float over everything).
 */
export function clampCollapsedTop(top: number): number {
  if (isDesktopShell()) return top;
  return Math.max(top, NAV_HEIGHT_PX + 8);
}

export function floatingContainerStyle(prefs: FloatingUiPrefs): CSSProperties {
  const base: CSSProperties = {
    position: "fixed",
    width: prefs.collapsed ? undefined : prefs.width,
    height: prefs.collapsed ? undefined : prefs.height,
  };

  if (prefs.position === "custom") {
    const top = prefs.collapsed ? clampCollapsedTop(prefs.y) : prefs.y;
    return { ...base, left: prefs.x, top };
  }

  switch (prefs.position) {
    case "top-left":
      return { ...base, top: prefs.collapsed ? clampCollapsedTop(CORNER_MARGIN) : CORNER_MARGIN, left: CORNER_MARGIN };
    case "bottom-left":
      return { ...base, bottom: CORNER_MARGIN, left: CORNER_MARGIN };
    case "bottom-right":
      return { ...base, bottom: CORNER_MARGIN, right: CORNER_MARGIN };
    case "top-right":
    default:
      return { ...base, top: prefs.collapsed ? clampCollapsedTop(CORNER_MARGIN) : CORNER_MARGIN, right: CORNER_MARGIN };
  }
}
