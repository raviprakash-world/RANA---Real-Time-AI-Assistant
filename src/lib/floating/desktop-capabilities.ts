import type { PresentationDisplayChoice } from "./types";

/**
 * Platform capability abstraction (spec section 17/18). The desktop shell
 * (electron/preload.js) computes this once from the real OS/Electron APIs
 * and exposes it on `window.desktopShell.capabilities` — the UI reads it to
 * decide what to show/enable, and reports "Unsupported on this platform"
 * honestly rather than presenting a control that silently does nothing.
 */
export interface DesktopCapabilities {
  platform: "darwin" | "win32" | "linux" | "web";
  alwaysOnTop: boolean;
  transparency: boolean;
  transparencyNote?: string;
  globalShortcuts: boolean;
  clickThrough: boolean;
  multiMonitor: boolean;
  tray: boolean;
}

export const WEB_CAPABILITIES: DesktopCapabilities = {
  platform: "web",
  alwaysOnTop: false,
  transparency: false,
  globalShortcuts: false,
  clickThrough: false,
  multiMonitor: false,
  tray: false,
};

export interface DisplayInfo {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  isPrimary: boolean;
}

export interface DesktopShellApi {
  isDesktop: true;
  capabilities: DesktopCapabilities;
  notifySessionStarted: (sessionId: string) => void;
  notifySessionEnded: () => void;
  reportBounds: (bounds: { x: number; y: number; width: number; height: number }) => void;
  setAlwaysOnTop: (enabled: boolean) => void;
  toggleClickThrough: () => void;
  resetPosition: () => void;
  getDisplays: () => Promise<DisplayInfo[]>;
  /** Captures the screen the cursor is currently on. Returns a data URL, or an error (e.g. missing OS permission). */
  captureScreenshot: () => Promise<{ dataUrl: string; error?: undefined } | { dataUrl?: undefined; error: string }>;
  setPresentationMode: (enabled: boolean, display: PresentationDisplayChoice) => void;
  moveToSecondaryDisplay: () => void;
  onShortcut: (callback: (action: DesktopShortcutAction) => void) => () => void;
  onBoundsCorrected: (callback: (bounds: { x: number; y: number; width: number; height: number }) => void) => () => void;
  onClickThroughChanged: (callback: (enabled: boolean) => void) => () => void;
}

export type DesktopShortcutAction =
  | "toggle-visibility"
  | "focus-ask"
  | "toggle-pause"
  | "toggle-transcript"
  | "end-session"
  | "toggle-presentation"
  | "toggle-focus";

declare global {
  interface Window {
    desktopShell?: DesktopShellApi;
  }
}

export function getDesktopShell(): DesktopShellApi | null {
  if (typeof window === "undefined") return null;
  return window.desktopShell ?? null;
}

export function getCapabilities(): DesktopCapabilities {
  return getDesktopShell()?.capabilities ?? WEB_CAPABILITIES;
}
