"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { DEFAULT_FLOATING_UI_PREFS, FloatingUiPrefs, mergeFloatingUiPrefs } from "@/lib/floating/types";

/**
 * Loads the persisted floating-panel state (position/size/opacity/theme/
 * density/font size/focus mode/etc.) from UserPreference.floatingUi and
 * keeps it in sync. Updates are applied to local state immediately (so
 * dragging/resizing feels instant) and persisted to the server debounced,
 * so a drag doesn't fire a PATCH per pixel.
 */
export function useFloatingPreferences() {
  const [prefs, setPrefs] = useState<FloatingUiPrefs>(DEFAULT_FLOATING_UI_PREFS);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api
      .getPreferences()
      .then((r) => setPrefs(mergeFloatingUiPrefs(r.preference.floatingUi)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const persist = useCallback((patch: Partial<FloatingUiPrefs>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.updatePreferences({ floatingUi: patch }).catch(() => {});
    }, 400);
  }, []);

  /** Updates local state immediately; persists (debounced) unless persistImmediately/skip. */
  const update = useCallback(
    (patch: Partial<FloatingUiPrefs>, opts: { persist?: boolean } = { persist: true }) => {
      setPrefs((prev) => ({ ...prev, ...patch }));
      if (opts.persist !== false) persist(patch);
    },
    [persist]
  );

  return { prefs, update, loaded };
}
