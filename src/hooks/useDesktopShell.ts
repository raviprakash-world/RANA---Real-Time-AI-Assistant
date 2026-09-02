"use client";

import { useEffect, useRef } from "react";
import { DesktopShortcutAction, getCapabilities, getDesktopShell } from "@/lib/floating/desktop-capabilities";

export function useDesktopCapabilities() {
  return getCapabilities();
}

/**
 * Subscribes to desktop-shell shortcut/bounds-correction events for the
 * lifetime of the component. No-ops entirely in a plain browser tab
 * (getDesktopShell() returns null there) — callers don't need to branch on
 * isDesktop themselves. The "always latest callback" ref is updated in its
 * own effect (not during render) per the React Compiler's rules-of-hooks lint.
 */
export function useDesktopShortcuts(onShortcut: (action: DesktopShortcutAction) => void) {
  const handlerRef = useRef(onShortcut);
  useEffect(() => {
    handlerRef.current = onShortcut;
  });

  useEffect(() => {
    const shell = getDesktopShell();
    if (!shell) return;
    return shell.onShortcut((action) => handlerRef.current(action));
  }, []);
}

export function useDesktopBoundsCorrection(onCorrected: (bounds: { x: number; y: number; width: number; height: number }) => void) {
  const handlerRef = useRef(onCorrected);
  useEffect(() => {
    handlerRef.current = onCorrected;
  });

  useEffect(() => {
    const shell = getDesktopShell();
    if (!shell) return;
    return shell.onBoundsCorrected((bounds) => handlerRef.current(bounds));
  }, []);
}

export function useDesktopClickThroughState(onChanged: (enabled: boolean) => void) {
  const handlerRef = useRef(onChanged);
  useEffect(() => {
    handlerRef.current = onChanged;
  });

  useEffect(() => {
    const shell = getDesktopShell();
    if (!shell) return;
    return shell.onClickThroughChanged((enabled) => handlerRef.current(enabled));
  }, []);
}
