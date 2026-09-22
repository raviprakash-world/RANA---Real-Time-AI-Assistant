const {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  Tray,
  screen,
  shell,
  ipcMain,
  nativeImage,
  desktopCapturer,
} = require("electron");

const path = require("node:path");

/**
 * ============================================================================
 * Real-Time Assistant — Electron Main Process
 * ============================================================================
 *
 * Responsibilities:
 * - Create/manage launcher and HUD windows
 * - Apply OS-level content protection to every BrowserWindow
 * - Manage tray + global shortcuts
 * - Handle multi-monitor positioning
 * - Bridge desktop actions to the renderer
 *
 * IMPORTANT:
 * The actual session/AI/SSE logic lives in the Next.js application.
 * This process is only the desktop shell.
 * ============================================================================
 */

/**
 * ============================================================================
 * Configuration
 * ============================================================================
 */

const TARGET_URL =
  process.env.RTA_URL || "http://localhost:3000";

const PRELOAD = path.join(__dirname, "preload.js");

const SHORTCUTS = {
  "CommandOrControl+Shift+Space": "toggle-visibility",
  "CommandOrControl+Shift+A": "focus-ask",
  "CommandOrControl+Shift+P": "toggle-pause",
  "CommandOrControl+Shift+T": "toggle-transcript",
  "CommandOrControl+Shift+X": "toggle-click-through",
  "CommandOrControl+Shift+H": "toggle-presentation",
  "CommandOrControl+Shift+M": "move-to-secondary",
  "CommandOrControl+Shift+F": "toggle-focus",
};

const END_DEBOUNCE_MS = 400;

const PRESENTATION_SIZE = {
  width: 160,
  height: 56,
};

/**
 * ============================================================================
 * Application State
 * ============================================================================
 */

let launcherWindow = null;
let hudWindow = null;
let tray = null;

let clickThroughEnabled = false;
let sessionActive = false;
let currentHudSessionId = null;

let pendingEndTimer = null;
let presentationSavedBounds = null;

app.isQuitting = false;

/**
 * ============================================================================
 * SECURITY / CONTENT PROTECTION
 * ============================================================================
 *
 * Centralized protection function.
 *
 * Electron's setContentProtection(true) asks the OS to prevent the window
 * contents from appearing in supported screen-capture / screenshot paths.
 *
 * IMPORTANT:
 * This is NOT a guarantee against every possible capture mechanism.
 * OS-level protections vary by platform and capture technology.
 *
 * The window is also created hidden and only shown after ready-to-show.
 * This avoids intentionally exposing an unprotected first frame.
 * ============================================================================
 */

function protect(win) {
  if (!win || win.isDestroyed()) {
    return false;
  }

  try {
    win.setContentProtection(true);

    console.log(
      `[desktop/security] Content protection enabled for window ${win.id}`
    );

    return true;
  } catch (error) {
    console.error(
      `[desktop/security] Failed to enable content protection for window ${win.id}`,
      error
    );

    return false;
  }
}

/**
 * Fail-closed for every BrowserWindow.
 *
 * This covers:
 * - launcher
 * - HUD
 * - future popup windows
 * - DevTools windows where applicable
 * - windows created by third-party code inside this process
 *
 * The explicit protect() calls in the individual window factories remain
 * intentionally present as defense-in-depth and to make the security
 * requirement obvious at the creation site.
 */
app.on("browser-window-created", (_event, win) => {
  protect(win);
});

/**
 * ============================================================================
 * Window Helpers
 * ============================================================================
 */

/**
 * Configure common secure BrowserWindow settings.
 */
function getSecureWebPreferences() {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    preload: PRELOAD,

    // Do not expose DevTools in packaged production builds.
    devTools: !app.isPackaged,
  };
}

/**
 * Open external URLs in the system browser.
 *
 * Never allow arbitrary child BrowserWindows to be created by renderer
 * navigation.
 */
function configureExternalNavigation(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      shell.openExternal(url);
    } catch (error) {
      console.error(
        "[desktop] Failed to open external URL:",
        error
      );
    }

    return {
      action: "deny",
    };
  });
}

/**
 * ============================================================================
 * Launcher Window
 * ============================================================================
 */

function createLauncherWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 720,

    minWidth: 640,
    minHeight: 480,

    title: "Real-Time Assistant",

    backgroundColor: "#0a0b0d",

    /**
     * IMPORTANT:
     * Keep hidden until content protection has been applied and Electron
     * reports that the first frame is ready.
     */
    show: false,

    webPreferences: getSecureWebPreferences(),
  });

  /**
   * Defense-in-depth.
   *
   * browser-window-created also invokes protect(), but explicitly doing it
   * here documents the security requirement for this window.
   */
  protect(win);

  configureExternalNavigation(win);

  win.on("ready-to-show", () => {
    if (!win.isDestroyed()) {
      win.show();
    }
  });

  win.on("closed", () => {
    if (launcherWindow === win) {
      launcherWindow = null;
    }
  });

  win.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.loadURL(TARGET_URL);

  return win;
}

/**
 ============================================================================
 * Display / Bounds Helpers
 * ============================================================================
 */

/**
 * Keeps bounds fully inside at least one connected display.
 */
function clampToDisplays(bounds) {
  const displays = screen.getAllDisplays();

  if (!displays.length) {
    return bounds;
  }

  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };

  const onScreen = displays.some((display) => {
    const area = display.workArea;

    return (
      center.x >= area.x &&
      center.x <= area.x + area.width &&
      center.y >= area.y &&
      center.y <= area.y + area.height
    );
  });

  if (onScreen) {
    return bounds;
  }

  const primary = screen.getPrimaryDisplay().workArea;

  const width = Math.min(
    bounds.width,
    Math.max(320, primary.width - 32)
  );

  const height = Math.min(
    bounds.height,
    Math.max(180, primary.height - 32)
  );

  return {
    x: primary.x + primary.width - width - 16,
    y: primary.y + 16,
    width,
    height,
  };
}

/**
 * ============================================================================
 * Presentation Mode
 * ============================================================================
 */

function computePresentationBounds(displayChoice) {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();

  const currentDisplay = hudWindow
    ? screen.getDisplayMatching(hudWindow.getBounds())
    : primary;

  let target = currentDisplay;

  if (
    displayChoice === "secondary" ||
    displayChoice === "auto"
  ) {
    const other = displays.find(
      (display) => display.id !== currentDisplay.id
    );

    if (other) {
      target = other;
    } else if (displayChoice === "secondary") {
      console.warn(
        '[desktop] Presentation display set to "secondary" but only one display is connected — staying on the current display.'
      );
    }
  }

  const area = target.workArea;

  return {
    x: Math.round(
      area.x +
        area.width -
        PRESENTATION_SIZE.width -
        16
    ),

    y: Math.round(area.y + 16),

    width: PRESENTATION_SIZE.width,
    height: PRESENTATION_SIZE.height,
  };
}

/**
 * ============================================================================
 * Move HUD Between Displays
 * ============================================================================
 */

function computeMoveBounds(displayChoice) {
  const displays = screen.getAllDisplays();

  const currentDisplay = hudWindow
    ? screen.getDisplayMatching(hudWindow.getBounds())
    : screen.getPrimaryDisplay();

  let target = currentDisplay;

  if (
    displayChoice === "secondary" ||
    displayChoice === "auto"
  ) {
    const other = displays.find(
      (display) => display.id !== currentDisplay.id
    );

    if (other) {
      target = other;
    } else if (displayChoice === "secondary") {
      console.warn(
        '[desktop] Move-to-secondary requested but only one display is connected — staying on the current display.'
      );
    }
  }

  if (!hudWindow || hudWindow.isDestroyed()) {
    return target.workArea;
  }

  const current = hudWindow.getBounds();

  const fromArea = currentDisplay.workArea;
  const toArea = target.workArea;

  const width = Math.min(
    current.width,
    toArea.width
  );

  const height = Math.min(
    current.height,
    toArea.height
  );

  const relX = current.x - fromArea.x;
  const relY = current.y - fromArea.y;

  const x = Math.min(
    Math.max(toArea.x + relX, toArea.x),
    toArea.x + toArea.width - width
  );

  const y = Math.min(
    Math.max(toArea.y + relY, toArea.y),
    toArea.y + toArea.height - height
  );

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function moveHudToSecondaryDisplay() {
  if (!hudWindow || hudWindow.isDestroyed()) {
    return;
  }

  hudWindow.setBounds(
    computeMoveBounds("secondary")
  );
}

/**
 * ============================================================================
 * HUD Window
 * ============================================================================
 */

function createHudWindow(sessionId) {
  // The real resize ceiling should be "how big is this screen", not a
  // product-chosen number — a fixed 700x800 cap meant the HUD literally
  // could not grow past that on any monitor, no matter how much room was
  // available. Bound it by the work area of whichever display the window
  // opens on instead, so "resize it as large as you want" is actually true
  // up to what the OS can show.
  const workArea = screen.getPrimaryDisplay().workArea;
  const maxWidth = Math.max(900, workArea.width - 24);
  const maxHeight = Math.max(800, workArea.height - 24);

  const win = new BrowserWindow({
    width: 1053,
    height: 512,

    minWidth: 320,
    minHeight: 180,

    maxWidth,
    maxHeight,

    frame: false,
    transparent: true,
    hasShadow: true,

    alwaysOnTop: true,
    resizable: true,

    skipTaskbar: false,

    title: "Real-Time Assistant",

    backgroundColor: "#00000000",

    /**
     * Security requirement:
     * Never initially display the HUD before protection is applied.
     */
    show: false,

    webPreferences: getSecureWebPreferences(),
  });

  /**
   * Defense-in-depth.
   */
  protect(win);

  configureExternalNavigation(win);

  win.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription) => {
      console.error(
        `[desktop] HUD failed to load: ${errorCode} ${errorDescription}`
      );
    }
  );

  win.on("ready-to-show", () => {
    if (!win.isDestroyed()) {
      win.show();
    }
  });

  win.on("moved", () => {
    reportBoundsIfInvalid(win);
  });

  win.on("closed", () => {
    if (hudWindow === win) {
      hudWindow = null;
    }

    if (currentHudSessionId === sessionId) {
      currentHudSessionId = null;
    }
  });

  win.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.loadURL(
    `${TARGET_URL}/sessions/${sessionId}?hud=1`
  );

  return win;
}

/**
 * ============================================================================
 * Bounds Validation
 * ============================================================================
 */

function reportBoundsIfInvalid(win) {
  if (!win || win.isDestroyed()) {
    return;
  }

  const bounds = win.getBounds();
  const fixed = clampToDisplays(bounds);

  const changed =
    fixed.x !== bounds.x ||
    fixed.y !== bounds.y ||
    fixed.width !== bounds.width ||
    fixed.height !== bounds.height;

  if (!changed) {
    return;
  }

  win.setBounds(fixed);

  if (!win.webContents.isDestroyed()) {
    win.webContents.send(
      "desktop:bounds-corrected",
      fixed
    );
  }
}

/**
 * ============================================================================
 * HUD Visibility
 * ============================================================================
 */

function toggleHudVisibility() {
  if (!hudWindow || hudWindow.isDestroyed()) {
    return;
  }

  if (
    hudWindow.isVisible() &&
    !hudWindow.isMinimized()
  ) {
    hudWindow.hide();
    return;
  }

  hudWindow.show();
  hudWindow.focus();
}

/**
 * ============================================================================
 * Renderer Shortcut Communication
 * ============================================================================
 */

function sendShortcut(action) {
  if (!hudWindow || hudWindow.isDestroyed()) {
    return;
  }

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

  if (!hudWindow.webContents.isDestroyed()) {
    hudWindow.webContents.send(
      "desktop:shortcut",
      action
    );
  }
}

/**
 * ============================================================================
 * Click Through
 * ============================================================================
 */

function setClickThrough(enabled) {
  clickThroughEnabled = Boolean(enabled);

  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.setIgnoreMouseEvents(
      clickThroughEnabled,
      {
        forward: true,
      }
    );

    if (!hudWindow.webContents.isDestroyed()) {
      hudWindow.webContents.send(
        "desktop:click-through-changed",
        clickThroughEnabled
      );
    }
  }

  updateTrayMenu();
}

/**
 * ============================================================================
 * Global Shortcuts
 * ============================================================================
 */

function registerGlobalShortcuts() {
  for (const [
    accelerator,
    action,
  ] of Object.entries(SHORTCUTS)) {
    const registered = globalShortcut.register(
      accelerator,
      () => sendShortcut(action)
    );

    console.log(
      `[desktop] shortcut ${accelerator} (${action}) registered: ${registered}`
    );

    if (!registered) {
      console.warn(
        `[desktop] "${accelerator}" is already taken by another application — that shortcut won't work here.`
      );
    }
  }
}

/**
 * ============================================================================
 * Tray
 * ============================================================================
 */

function updateTrayMenu() {
  if (!tray) {
    return;
  }

  const template = [
    {
      label: "Real-Time Assistant",
      enabled: false,
    },

    {
      label: sessionActive
        ? "● Session Active"
        : "○ No Active Session",
      enabled: false,
    },

    {
      type: "separator",
    },

    {
      label: "Show Assistant",
      enabled: sessionActive,
      click: () => toggleHudVisibility(),
    },

    {
      label: "Pause / Resume",
      enabled: sessionActive,
      click: () =>
        sendShortcut("toggle-pause"),
    },

    {
      label: "End Session",
      enabled: sessionActive,
      click: () =>
        sendShortcut("end-session"),
    },

    {
      type: "separator",
    },

    {
      label: clickThroughEnabled
        ? "Disable Click-Through"
        : "Enable Click-Through",

      enabled: sessionActive,

      click: () =>
        setClickThrough(
          !clickThroughEnabled
        ),
    },

    {
      type: "separator",
    },

    {
      label: "Open Dashboard",
      click: () =>
        showLauncher("/"),
    },

    {
      label: "Settings",
      click: () =>
        showLauncher("/settings"),
    },

    {
      type: "separator",
    },

    {
      label: "Quit",

      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ];

  tray.setContextMenu(
    Menu.buildFromTemplate(template)
  );
}

function createTray() {
  /**
   * Transparent placeholder icon.
   */
  const icon = nativeImage.createEmpty();

  tray = new Tray(icon);

  if (process.platform === "darwin") {
    tray.setTitle("●");
  }

  tray.setToolTip("Real-Time Assistant");

  tray.on("click", () => {
    if (sessionActive) {
      toggleHudVisibility();
    } else {
      showLauncher("/");
    }
  });

  updateTrayMenu();
}

/**
 * ============================================================================
 * Launcher Navigation
 * ============================================================================
 */

function showLauncher(route = "/") {
  if (
    !launcherWindow ||
    launcherWindow.isDestroyed()
  ) {
    launcherWindow =
      createLauncherWindow();
  }

  const targetUrl =
    `${TARGET_URL}${route || "/"}`;

  if (
    launcherWindow.webContents.getURL() !==
    targetUrl
  ) {
    launcherWindow.loadURL(targetUrl);
  }

  launcherWindow.show();
  launcherWindow.focus();
}

/**
 * ============================================================================
 * Session Lifecycle
 * ============================================================================
 *
 * React can mount/unmount/remount during development and full page reloads.
 *
 * Therefore:
 *
 * session-ended
 *      ↓
 * debounce
 *      ↓
 * session-started arrives?
 *      ↓
 * cancel end
 *
 * This prevents reload/remount loops.
 * ============================================================================
 */

ipcMain.on(
  "desktop:session-started",
  (_event, sessionId) => {
    if (pendingEndTimer) {
      clearTimeout(pendingEndTimer);
      pendingEndTimer = null;
    }

    sessionActive = true;

    if (
      currentHudSessionId === sessionId &&
      hudWindow &&
      !hudWindow.isDestroyed()
    ) {
      hudWindow.show();

      launcherWindow?.hide();

      updateTrayMenu();

      return;
    }

    currentHudSessionId = sessionId;

    if (
      !hudWindow ||
      hudWindow.isDestroyed()
    ) {
      hudWindow =
        createHudWindow(sessionId);
    } else {
      /**
       * Content protection remains enabled on the existing BrowserWindow
       * across navigation.
       */
      protect(hudWindow);

      hudWindow.loadURL(
        `${TARGET_URL}/sessions/${sessionId}?hud=1`
      );

      /**
       * Do not wait for ready-to-show here if the window was already
       * previously shown and protected.
       */
      hudWindow.show();
    }

    launcherWindow?.hide();

    updateTrayMenu();
  }
);

ipcMain.on(
  "desktop:session-ended",
  () => {
    if (pendingEndTimer) {
      clearTimeout(pendingEndTimer);
    }

    pendingEndTimer = setTimeout(() => {
      pendingEndTimer = null;

      sessionActive = false;
      currentHudSessionId = null;

      if (
        hudWindow &&
        !hudWindow.isDestroyed()
      ) {
        hudWindow.hide();
      }

      setClickThrough(false);

      showLauncher("/");

      updateTrayMenu();
    }, END_DEBOUNCE_MS);
  }
);

/**
 * ============================================================================
 * Bounds IPC
 * ============================================================================
 */

ipcMain.on(
  "desktop:report-bounds",
  (_event, bounds) => {
    if (
      !hudWindow ||
      hudWindow.isDestroyed() ||
      !bounds
    ) {
      return;
    }

    const currentBounds =
      hudWindow.getBounds();

    const requestedBounds = {
      ...currentBounds,
      ...bounds,
    };

    const fixed =
      clampToDisplays(requestedBounds);

    hudWindow.setBounds({
      x: Math.round(fixed.x),
      y: Math.round(fixed.y),
      width: Math.round(fixed.width),
      height: Math.round(fixed.height),
    });
  }
);

/**
 * ============================================================================
 * Always On Top
 * ============================================================================
 */

ipcMain.on(
  "desktop:set-always-on-top",
  (_event, enabled) => {
    if (
      !hudWindow ||
      hudWindow.isDestroyed()
    ) {
      return;
    }

    hudWindow.setAlwaysOnTop(
      Boolean(enabled)
    );
  }
);

/**
 * ============================================================================
 * Click Through IPC
 * ============================================================================
 */

ipcMain.on(
  "desktop:toggle-click-through",
  () => {
    setClickThrough(
      !clickThroughEnabled
    );
  }
);

/**
 * ============================================================================
 * Display Information
 * ============================================================================
 */

ipcMain.handle(
  "desktop:get-displays",
  () => {
    const primaryId =
      screen.getPrimaryDisplay().id;

    return screen
      .getAllDisplays()
      .map((display, index) => ({
        id: display.id,

        label:
          display.id === primaryId
            ? "Primary display"
            : `Display ${index + 1}`,

        bounds: display.bounds,

        isPrimary:
          display.id === primaryId,
      }));
  }
);

/**
 * ============================================================================
 * Screenshot Capture (spec: "screenshot a coding problem in the meeting")
 * ============================================================================
 */

ipcMain.handle(
  "desktop:capture-screenshot",
  async () => {
    try {
      // Capture whichever display the cursor is currently on — that's the
      // screen the user is actually looking at (the meeting/problem), not
      // necessarily the primary display if the HUD lives on a secondary one.
      const cursorPoint = screen.getCursorScreenPoint();
      const targetDisplay = screen.getDisplayNearestPoint(cursorPoint);

      // Cap the capture resolution — full native resolution on a 4K/5K
      // display makes for a multi-MB PNG that's slow to upload and no more
      // legible to a vision model; 1920px on the long edge is still plenty
      // to read a code editor or a problem statement.
      const scale = Math.min(1, 1920 / targetDisplay.size.width);
      const thumbnailSize = {
        width: Math.round(targetDisplay.size.width * scale),
        height: Math.round(targetDisplay.size.height * scale),
      };

      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize,
      });
      if (sources.length === 0) {
        return {
          error:
            "No screen source available. macOS may require Screen Recording permission (System Settings → Privacy & Security → Screen Recording), then a restart.",
        };
      }

      const matched =
        sources.find((s) => s.display_id && String(targetDisplay.id) === s.display_id) ??
        sources[0];

      return { dataUrl: matched.thumbnail.toDataURL() };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Screenshot capture failed." };
    }
  }
);

/**
 * ============================================================================
 * Presentation Mode IPC
 * ============================================================================
 *
 * Presentation mode only changes the existing HUD window's bounds.
 * No second window is created.
 * ============================================================================
 */

ipcMain.on(
  "desktop:set-presentation-mode",
  (_event, { enabled, display }) => {
    if (
      !hudWindow ||
      hudWindow.isDestroyed()
    ) {
      return;
    }

    if (enabled) {
      presentationSavedBounds =
        hudWindow.getBounds();

      hudWindow.setBounds(
        computePresentationBounds(
          display
        )
      );

      return;
    }

    if (presentationSavedBounds) {
      hudWindow.setBounds(
        clampToDisplays(
          presentationSavedBounds
        )
      );

      presentationSavedBounds = null;
    }
  }
);

/**
 * ============================================================================
 * Move To Secondary Display
 * ============================================================================
 */

ipcMain.on(
  "desktop:move-to-secondary",
  () => {
    moveHudToSecondaryDisplay();
  }
);

/**
 * ============================================================================
 * Reset HUD Position
 * ============================================================================
 */

ipcMain.on(
  "desktop:reset-position",
  () => {
    if (
      !hudWindow ||
      hudWindow.isDestroyed()
    ) {
      return;
    }

    const primary =
      screen.getPrimaryDisplay().workArea;

    const bounds = {
      x:
        primary.x +
        primary.width -
        1053 -
        16,

      y:
        primary.y + 16,

      width: 1053,
      height: 512,
    };

    hudWindow.setBounds(bounds);

    if (!hudWindow.webContents.isDestroyed()) {
      hudWindow.webContents.send(
        "desktop:bounds-corrected",
        bounds
      );
    }
  }
);

/**
 * ============================================================================
 * Application Startup
 * ============================================================================
 */

app.whenReady().then(() => {
  console.log(
    `[desktop] ready, launcher loading ${TARGET_URL}`
  );

  launcherWindow =
    createLauncherWindow();

  createTray();

  registerGlobalShortcuts();

  app.on("activate", () => {
    if (
      BrowserWindow.getAllWindows()
        .length === 0
    ) {
      launcherWindow =
        createLauncherWindow();
    } else {
      showLauncher("/");
    }
  });
});

/**
 * ============================================================================
 * Application Shutdown
 * ============================================================================
 */

app.on("before-quit", () => {
  app.isQuitting = true;

  if (pendingEndTimer) {
    clearTimeout(pendingEndTimer);
    pendingEndTimer = null;
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});