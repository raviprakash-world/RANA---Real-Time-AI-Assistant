"use client";

import { getDesktopShell } from "@/lib/floating/desktop-capabilities";
import { FloatingUiPrefs } from "@/lib/floating/types";

/**
 * Shared enter/exit logic for Presentation Mode, used by both the floating
 * panel itself (FloatingAssistant.tsx, where the primary Cmd/Ctrl+Shift+H
 * shortcut and in-panel Exit control live) and the Settings page (which
 * offers a manual toggle plus the display picker). Keeping this in one
 * place avoids the two call sites drifting out of sync on the snapshot/
 * restore behavior.
 */
export function usePresentationMode(prefs: FloatingUiPrefs, update: (patch: Partial<FloatingUiPrefs>) => void) {
  function toggle() {
    if (prefs.presentationMode) {
      const snap = prefs.presentationSnapshot;
      update({
        presentationMode: false,
        presentationSnapshot: null,
        collapsed: snap?.collapsed ?? false,
        focusMode: snap?.focusMode ?? false,
      });
      getDesktopShell()?.setPresentationMode(false, prefs.presentationDisplay);
    } else {
      update({
        presentationMode: true,
        presentationSnapshot: { collapsed: prefs.collapsed, focusMode: prefs.focusMode },
        collapsed: true,
        focusMode: true,
      });
      getDesktopShell()?.setPresentationMode(true, prefs.presentationDisplay);
    }
  }

  return { active: prefs.presentationMode, toggle };
}
