#!/usr/bin/env node
/**
 * The prebuilt Electron.app that `npm install electron` downloads ships
 * ad-hoc signed with its Info.plist *unbound* from the signature. On
 * current macOS, TCC (Privacy & Security) won't reliably show a
 * permission prompt — or even list the app — for camera/microphone access
 * in that state, regardless of the NSMicrophoneUsageDescription key
 * already being present in Info.plist. Re-signing locally (ad-hoc, no
 * paid Apple identity needed) properly seals the Info.plist so TCC trusts
 * it. This is a known Electron/macOS packaging issue, not specific to
 * this app — see the README's desktop-shell section.
 *
 * Runs automatically via `postinstall` so a fresh `npm install` (which
 * re-downloads Electron and wipes any prior signature) doesn't silently
 * reintroduce the bug. No-ops on non-macOS platforms and never fails the
 * install if anything here goes wrong — this is a best-effort convenience
 * fix, not a required step.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function main() {
  if (process.platform !== "darwin") return;

  const appPath = path.join(__dirname, "..", "node_modules", "electron", "dist", "Electron.app");
  if (!fs.existsSync(appPath)) return;

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
