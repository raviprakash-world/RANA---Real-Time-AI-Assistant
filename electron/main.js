const { app, BrowserWindow, globalShortcut, Menu, Tray, screen, shell, ipcMain, nativeImage } = require("electron");
const path = require("node:path");

/**
 * Desktop shell for Real-Time Assistant — a private, compact, desktop-native
 * HUD for the live-session assistant, plus a normal launcher window for the
 * dashboard/history/settings/new-session flows. No application logic lives
 * here: this file only manages windows, global shortcuts, the tray, and
 * multi-monitor recovery. All session/AI/SSE logic stays in the existing
 * Next.js app — this shell just hosts it (section 20: no duplicated engine).
 *
 * IMPORTANT BOUNDARY: this shell does not attempt to hide the HUD window
 * from screen capture, recording, or monitoring software. It is a normal,
 * always-on-top desktop window — visible in the window list, Mission
 * Control/Alt-Tab, and any screen share or recording, exactly like any
 * other app. See README.md for the reasoning.
 *
 * Two windows:
 *  - launcherWindow: normal (framed, opaque) window for dashboard/history/
 *    settings/new-session. Shown at startup.
 *  - hudWindow: frameless, transparent, always-on-top-capable window that
 *    hosts a single active session's floating panel. Created/shown when a
 *    session starts, hidden when it ends.
 *
 * Both load the same running Next.js app (RTA_URL, default
 * http://localhost:3000) — just different routes.
 */
const TARGET_URL = process.env.RTA_URL || "http://localhost:3000";
const PRELOAD = path.join(__dirname, "preload.js");

const SHORTCUTS = {
  "CommandOrControl+Shift+Space": "toggle-visibility",
  "CommandOrControl+Shift+A": "focus-ask",
  "CommandOrControl+Shift+P": "toggle-pause",
  "CommandOrControl+Shift+T": "toggle-transcript",
  "CommandOrControl+Shift+X": "toggle-click-through",
  "CommandOrControl+Shift+H": "toggle-presentation",
  "CommandOrControl+Shift+M": "move-to-secondary",
};
// Esc is deliberately NOT registered as a global (OS-wide) shortcut — Electron's
// globalShortcut hijacks the key for every application on the system for as
// long as this app is running, which would break Esc in Zoom, VS Code, the
// browser, etc. It stays a page-scoped shortcut instead (only active while
// the HUD window itself has focus) — see section 6's "handle conflicts
// gracefully" and FloatingAssistant.tsx's local keydown handler.

let launcherWindow = null;
let hudWindow = null;
let tray = null;
let clickThroughEnabled = false;
let sessionActive = false;
let currentHudSessionId = null;
app.isQuitting = false;

function createLauncherWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    title: "Real-Time Assistant",
    backgroundColor: "#0a0b0d",
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: PRELOAD },
  });
  win.loadURL(TARGET_URL);
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
  return win;
}

/** Keeps `bounds` fully within some connected display's work area (section 14/15). */
function clampToDisplays(bounds) {
  const displays = screen.getAllDisplays();
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const onScreen = displays.some((d) => {
    const a = d.workArea;
    return center.x >= a.x && center.x <= a.x + a.width && center.y >= a.y && center.y <= a.y + a.height;
  });
  if (onScreen) return bounds;

  const primary = screen.getPrimaryDisplay().workArea;
  const width = Math.min(bounds.width, primary.width - 32);
  const height = Math.min(bounds.height, primary.height - 32);
  return { x: primary.x + primary.width - width - 16, y: primary.y + 16, width, height };
}

let presentationSavedBounds = null;
const PRESENTATION_SIZE = { width: 160, height: 56 };

/**
 * Picks where the compact indicator should sit for the requested display
 * choice (section 6/13 of the presentation-mode spec) — top-right corner
 * of whichever display is chosen, never inspecting or altering any other
 * application's window.
 */
function computePresentationBounds(displayChoice) {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const currentDisplay = hudWindow ? screen.getDisplayMatching(hudWindow.getBounds()) : primary;

  let target = currentDisplay;
  if (displayChoice === "secondary" || displayChoice === "auto") {
    const other = displays.find((d) => d.id !== currentDisplay.id);
    if (other) target = other;
    else if (displayChoice === "secondary") {
      console.warn("[desktop] Presentation display set to \"secondary\" but only one display is connected — staying on the current display.");
    }
  }

  const area = target.workArea;
  return {
    x: Math.round(area.x + area.width - PRESENTATION_SIZE.width - 16),
    y: Math.round(area.y + 16),
    width: PRESENTATION_SIZE.width,
    height: PRESENTATION_SIZE.height,
  };
}

/**
 * Moves the *existing* HUD window to another display, keeping its current
 * size and its relative position within the display's work area (so it
 * doesn't always jump to a fixed corner) — unlike Presentation Mode, this
 * never resizes or changes collapsed/focus state, it's just "put this
 * window over there." Falls back to the current display (with a console
 * warning) if no second display is connected.
 */
function computeMoveBounds(displayChoice) {
  const displays = screen.getAllDisplays();
  const currentDisplay = hudWindow ? screen.getDisplayMatching(hudWindow.getBounds()) : screen.getPrimaryDisplay();

  let target = currentDisplay;
  if (displayChoice === "secondary" || displayChoice === "auto") {
    const other = displays.find((d) => d.id !== currentDisplay.id);
    if (other) target = other;
    else if (displayChoice === "secondary") {
      console.warn("[desktop] Move-to-secondary requested but only one display is connected — staying on the current display.");
    }
  }

  const current = hudWindow.getBounds();
  const fromArea = currentDisplay.workArea;
  const toArea = target.workArea;
  const width = Math.min(current.width, toArea.width);
  const height = Math.min(current.height, toArea.height);
  const relX = current.x - fromArea.x;
  const relY = current.y - fromArea.y;
  const x = Math.min(Math.max(toArea.x + relX, toArea.x), toArea.x + toArea.width - width);
  const y = Math.min(Math.max(toArea.y + relY, toArea.y), toArea.y + toArea.height - height);

  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

function moveHudToSecondaryDisplay() {
  if (!hudWindow || hudWindow.isDestroyed()) return;
  hudWindow.setBounds(computeMoveBounds("secondary"));
}

function createHudWindow(sessionId) {
  const win = new BrowserWindow({
    width: 420,
    height: 600,
    minWidth: 320,
    minHeight: 180,
    maxWidth: 700,
    maxHeight: 800,
    frame: false,
    transparent: true,
    hasShadow: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    title: "Real-Time Assistant",
    backgroundColor: "#00000000",
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: PRELOAD },
  });

  win.loadURL(`${TARGET_URL}/sessions/${sessionId}?hud=1`);
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.on("moved", () => reportBoundsIfInvalid(win));

  return win;
}

/** If the HUD ends up with its center off every connected display, snap it back (section 14/15). */
function reportBoundsIfInvalid(win) {
  if (!win || win.isDestroyed()) return;
  const bounds = win.getBounds();
  const fixed = clampToDisplays(bounds);
  if (fixed !== bounds) {
    win.setBounds(fixed);
    win.webContents.send("desktop:bounds-corrected", fixed);
  }
}

function toggleHudVisibility() {
  if (!hudWindow) return;
  if (hudWindow.isVisible() && !hudWindow.isMinimized()) {
    hudWindow.hide();
  } else {
    hudWindow.show();
    hudWindow.focus();
  }
}

function sendShortcut(action) {
  if (!hudWindow) return;
  if (action === "toggle-visibility") {
    toggleHudVisibility();
    return;
  }
  if (action === "toggle-click-through") {
    setClickThrough(!clickThroughEnabled);
    return;
  }
  if (action === "move-to-secondary") {
    moveHudToSecondaryDisplay();
    return;
  }
  if (!hudWindow.isVisible()) {
    hudWindow.show();
  }
  hudWindow.webContents.send("desktop:shortcut", action);
}

function setClickThrough(enabled) {
  clickThroughEnabled = enabled;
  hudWindow?.setIgnoreMouseEvents(enabled, { forward: true });
  hudWindow?.webContents.send("desktop:click-through-changed", enabled);
  updateTrayMenu();
}

function registerGlobalShortcuts() {
  for (const [accelerator, action] of Object.entries(SHORTCUTS)) {
    const ok = globalShortcut.register(accelerator, () => sendShortcut(action));
    console.log(`[desktop] shortcut ${accelerator} (${action}) registered: ${ok}`);
    if (!ok) {
      console.warn(`[desktop] "${accelerator}" is already taken by another application — that shortcut won't work here.`);
    }
  }
}

function updateTrayMenu() {
  if (!tray) return;
  const template = [
    { label: "Real-Time Assistant", enabled: false },
    { label: sessionActive ? "● Session Active" : "○ No Active Session", enabled: false },
    { type: "separator" },
    { label: "Show Assistant", enabled: sessionActive, click: () => toggleHudVisibility() },
    { label: "Pause / Resume", enabled: sessionActive, click: () => sendShortcut("toggle-pause") },
    { label: "End Session", enabled: sessionActive, click: () => sendShortcut("end-session") },
    { type: "separator" },
    {
      label: clickThroughEnabled ? "Disable Click-Through" : "Enable Click-Through",
      enabled: sessionActive,
      click: () => setClickThrough(!clickThroughEnabled),
    },
    { type: "separator" },
    { label: "Open Dashboard", click: () => showLauncher("/") },
    { label: "Settings", click: () => showLauncher("/settings") },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  // A 1x1 transparent placeholder — macOS renders the title text set below
  // instead of relying on icon art (avoids needing to ship an icon asset).
  // On Windows/Linux the tray entry will show without a custom icon.
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  if (process.platform === "darwin") tray.setTitle("●");
  tray.setToolTip("Real-Time Assistant");
  tray.on("click", () => (sessionActive ? toggleHudVisibility() : showLauncher("/")));
  updateTrayMenu();
}

function showLauncher(path) {
  if (!launcherWindow || launcherWindow.isDestroyed()) launcherWindow = createLauncherWindow();
  const targetUrl = path ? `${TARGET_URL}${path}` : null;
  if (targetUrl && launcherWindow.webContents.getURL() !== targetUrl) {
    launcherWindow.loadURL(targetUrl);
  }
  launcherWindow.show();
  launcherWindow.focus();
}

// ---- IPC from the renderer ----

// The session page's mount effect fires notify-started on every mount and
// notify-ended on every unmount — including the mount/cleanup/remount dance
// React itself does in dev mode, and (more importantly) the remount that
// naturally follows any full page (re)load of the HUD window. Acting on
// "ended" immediately, followed by "started" reloading the window, was a
// real bug: each reload re-triggered the same mount/unmount pair, which
// reloaded again, forever (confirmed live — see chat). Debouncing "ended"
// so an immediate same-session "started" cancels it fixes this at the root,
// and still hides the HUD promptly on a real end-session (nothing re-starts
// the same session right after that).
let pendingEndTimer = null;
const END_DEBOUNCE_MS = 400;

ipcMain.on("desktop:session-started", (_event, sessionId) => {
  if (pendingEndTimer) {
    clearTimeout(pendingEndTimer);
    pendingEndTimer = null;
  }
  sessionActive = true;

  if (currentHudSessionId === sessionId && hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.show();
    launcherWindow?.hide();
    return;
  }
  currentHudSessionId = sessionId;

  if (!hudWindow || hudWindow.isDestroyed()) {
    hudWindow = createHudWindow(sessionId);
  } else {
    hudWindow.loadURL(`${TARGET_URL}/sessions/${sessionId}?hud=1`);
    hudWindow.show();
  }
  launcherWindow?.hide();
  updateTrayMenu();
});

ipcMain.on("desktop:session-ended", () => {
  if (pendingEndTimer) clearTimeout(pendingEndTimer);
  pendingEndTimer = setTimeout(() => {
    pendingEndTimer = null;
    sessionActive = false;
    currentHudSessionId = null;
    hudWindow?.hide();
    setClickThrough(false);
    showLauncher("/");
    updateTrayMenu();
  }, END_DEBOUNCE_MS);
});

ipcMain.on("desktop:report-bounds", (_event, bounds) => {
  if (!hudWindow || hudWindow.isDestroyed()) return;
  const fixed = clampToDisplays({ ...hudWindow.getBounds(), ...bounds });
  hudWindow.setBounds({
    x: Math.round(fixed.x),
    y: Math.round(fixed.y),
    width: Math.round(fixed.width),
    height: Math.round(fixed.height),
  });
});

ipcMain.on("desktop:set-always-on-top", (_event, enabled) => {
  hudWindow?.setAlwaysOnTop(Boolean(enabled));
});

ipcMain.on("desktop:toggle-click-through", () => setClickThrough(!clickThroughEnabled));

ipcMain.handle("desktop:get-displays", () => {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: d.id === primaryId ? "Primary display" : `Display ${i + 1}`,
    bounds: d.bounds,
    isPrimary: d.id === primaryId,
  }));
});

// Presentation Mode (section 6/7/11): moves the *existing* HUD window to a
// small corner of the requested display and back — never a second window,
// never anything that changes what's visible to screen-share recipients.
// The renderer owns collapsed/focusMode state; this only moves the OS
// window bounds to match.
ipcMain.on("desktop:set-presentation-mode", (_event, { enabled, display }) => {
  if (!hudWindow || hudWindow.isDestroyed()) return;
  if (enabled) {
    presentationSavedBounds = hudWindow.getBounds();
    hudWindow.setBounds(computePresentationBounds(display));
  } else if (presentationSavedBounds) {
    hudWindow.setBounds(clampToDisplays(presentationSavedBounds));
    presentationSavedBounds = null;
  }
});

ipcMain.on("desktop:move-to-secondary", () => moveHudToSecondaryDisplay());

ipcMain.on("desktop:reset-position", () => {
  if (!hudWindow || hudWindow.isDestroyed()) return;
  const primary = screen.getPrimaryDisplay().workArea;
  const bounds = { x: primary.x + primary.width - 420 - 16, y: primary.y + 16, width: 420, height: 600 };
  hudWindow.setBounds(bounds);
  hudWindow.webContents.send("desktop:bounds-corrected", bounds);
});

app.whenReady().then(() => {
  console.log(`[desktop] ready, launcher loading ${TARGET_URL}`);
  launcherWindow = createLauncherWindow();
  createTray();
  registerGlobalShortcuts();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      launcherWindow = createLauncherWindow();
    } else {
      showLauncher();
    }
  });
});

app.on("before-quit", () => {
  app.isQuitting = true;
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
