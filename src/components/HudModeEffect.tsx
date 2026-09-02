"use client";

import { useEffect } from "react";

/**
 * The desktop shell's HUD window loads session pages with `?hud=1` (see
 * electron/main.js) — a plain visual signal, not a security boundary, that
 * says "this window is the frameless/transparent HUD, not the normal
 * launcher window." Hides the app's own nav chrome and lets the page
 * background go transparent so the OS-level window transparency (also set
 * only for the HUD window) actually shows through. The launcher window
 * (dashboard/history/settings) never gets this param and renders normally.
 */
export function HudModeEffect() {
  useEffect(() => {
    const isHud = new URLSearchParams(window.location.search).get("hud") === "1";
    document.body.classList.toggle("hud-mode", isHud);
  }, []);

  return null;
}
