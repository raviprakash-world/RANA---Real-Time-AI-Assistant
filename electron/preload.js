const { contextBridge, ipcRenderer } = require("electron");

/**
 * Secure bridge between the renderer (the normal Next.js web app) and the
 * desktop shell (main.js). contextIsolation stays on and nodeIntegration
 * stays off — the renderer never gets raw `ipcRenderer`/Node access, only
 * this narrow, purpose-built API (section 16: no secrets, no broad Node
 * access reach the page).
 *
 * Capabilities are computed once, synchronously, from real platform facts
 * (no network round-trip needed) — see desktop-capabilities.ts for the
 * shape the renderer consumes.
 */
const platform = process.platform;

const transparencyNotes = {
  darwin: undefined,
  win32: "Supported on Windows 10/11 with desktop composition enabled.",
  linux: "Depends on the window manager/compositor — not all Linux desktops render window transparency.",
};

const capabilities = {
  platform,
  alwaysOnTop: true,
  transparency: platform === "darwin" || platform === "win32",
  transparencyNote: transparencyNotes[platform],
  globalShortcuts: true,
  clickThrough: true,
  multiMonitor: true,
  tray: true,
};

function onIpc(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("desktopShell", {
  isDesktop: true,
  capabilities,

  notifySessionStarted: (sessionId) => ipcRenderer.send("desktop:session-started", sessionId),
  notifySessionEnded: () => ipcRenderer.send("desktop:session-ended"),
  reportBounds: (bounds) => ipcRenderer.send("desktop:report-bounds", bounds),
  setAlwaysOnTop: (enabled) => ipcRenderer.send("desktop:set-always-on-top", enabled),
  toggleClickThrough: () => ipcRenderer.send("desktop:toggle-click-through"),
  resetPosition: () => ipcRenderer.send("desktop:reset-position"),
  getDisplays: () => ipcRenderer.invoke("desktop:get-displays"),
  captureScreenshot: () => ipcRenderer.invoke("desktop:capture-screenshot"),
  setPresentationMode: (enabled, display) => ipcRenderer.send("desktop:set-presentation-mode", { enabled, display }),
  moveToSecondaryDisplay: () => ipcRenderer.send("desktop:move-to-secondary"),

  onShortcut: (callback) => onIpc("desktop:shortcut", callback),
  onBoundsCorrected: (callback) => onIpc("desktop:bounds-corrected", callback),
  onClickThroughChanged: (callback) => onIpc("desktop:click-through-changed", callback),
});
