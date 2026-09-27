#!/usr/bin/env node
/**
 * Patches the local, prebuilt `node_modules/electron/dist/Electron.app` that
 * `npm install electron` downloads. Runs automatically via `postinstall` so
 * a fresh `npm install` (which re-downloads Electron and wipes any prior
 * patch) doesn't silently reintroduce either issue below. No-ops on
 * non-macOS platforms and never fails the install if anything here goes
 * wrong — this is a best-effort dev-convenience fix, not a required step
 * (and irrelevant to a real packaged build — see `build.productName` in
 * package.json for that).
 *
 * Two unrelated things, done together only because both end with the same
 * re-sign of the same bundle:
 *
 * 1. Signing: the prebuilt Electron.app ships ad-hoc signed with its
 *    Info.plist *unbound* from the signature. On current macOS, TCC
 *    (Privacy & Security) won't reliably show a permission prompt — or
 *    even list the app — for camera/microphone access in that state,
 *    regardless of the NSMicrophoneUsageDescription key already being
 *    present in Info.plist. Re-signing locally (ad-hoc, no paid Apple
 *    identity needed) properly seals the Info.plist so TCC trusts it.
 *    This is a known Electron/macOS packaging issue, not specific to this
 *    app — see the README's desktop-shell section.
 *
 * 2. Branding: in dev (unpackaged) mode, the macOS menu bar reads the app
 *    name from this same Electron.app bundle's Info.plist, not from
 *    app.setName() in electron/main.js (setName affects other things —
 *    Dock tooltip text default, Activity Monitor process grouping, the
 *    userData path — but not the dev-mode menu bar). Without this, the
 *    menu bar shows "Electron" no matter what the app itself is named.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const APP_NAME = "RANA"; // must match electron/main.js app.setName() call

function main() {
  if (process.platform !== "darwin") return;

  const appPath = path.join(__dirname, "..", "node_modules", "electron", "dist", "Electron.app");
  const infoPlistPath = path.join(appPath, "Contents", "Info.plist");
  if (!fs.existsSync(appPath)) return;

  if (fs.existsSync(infoPlistPath)) {
    try {
      for (const key of ["CFBundleName", "CFBundleDisplayName"]) {
        execFileSync("plutil", ["-replace", key, "-string", APP_NAME, infoPlistPath], { stdio: "pipe" });
      }
      console.log(`[postinstall] Renamed the dev Electron.app bundle to "${APP_NAME}" (menu bar, Activity Monitor).`);
    } catch (err) {
      console.warn(
        `[postinstall] Could not rename Electron.app's Info.plist (non-fatal — the desktop shell will still run, ` +
          `it'll just show "Electron" instead of "${APP_NAME}" in the menu bar).\n` +
          `Reason: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  try {
    execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "pipe" });
    console.log("[postinstall] Re-signed Electron.app so macOS grants microphone/camera permission prompts correctly.");
  } catch (err) {
    console.warn(
      "[postinstall] Could not re-sign Electron.app (non-fatal — the desktop shell will still run, but the OS " +
        "may not prompt for microphone access). You can retry manually:\n" +
        `  codesign --force --deep --sign - "${appPath}"\n` +
        `Reason: ${err instanceof Error ? err.message : err}`
    );
  }
}

main();
