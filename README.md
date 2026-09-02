# Real-Time Assistant

A real-time AI copilot for interviews, coding calls, system design discussions, and
meetings. Captures live conversation, detects questions worth reacting to, and
surfaces concise, speakable assistance — without flooding the user with noise.

## Stack

- **Next.js 15 (App Router, TypeScript)** — single full-stack app
- **Postgres + Prisma** — persistence (Docker Compose for local dev)
- **Server-Sent Events** — real-time transcript/AI event streaming
- **Web Speech API** — client-side speech-to-text in a real browser tab (free, low-latency)
- **OpenAI Whisper** — server-side speech-to-text for the Electron HUD, where Google blocks
  the Web Speech API's backend for non-Chrome embedders (see the desktop shell section)
- **OpenAI** (pluggable) — LLM reasoning, with a labeled mock fallback when no API key is set

## Getting started

```bash
docker compose up -d        # starts Postgres on localhost:5433
npm install
npx prisma migrate dev      # applies the schema
npm run dev                 # http://localhost:3000
```

Copy `.env.example` to `.env` (already done if you're reading this after setup) and set
`OPENAI_API_KEY` to get real AI responses. Without a key, the app runs against a clearly
labeled `MockLLMProvider` so the entire pipeline is exercisable with zero external
dependencies.

Speech recognition in a **browser tab** requires a Chromium-based browser (Chrome, Edge) —
Web Speech API support elsewhere is inconsistent. Everything else (manual "Ask AI",
history, summaries) works in any browser. The **Electron desktop HUD** automatically uses
a different path instead — see below.

## Desktop shell (private HUD overlay)

A browser tab can't stay on top of other windows, respond to a global keyboard shortcut,
or go frameless/transparent — that needs a native shell. With the web app already running
(`npm run dev` or `npm start`):

```bash
npm run desktop
```

This opens **two windows**, both hosting the same running Next.js app (no separate code
path, no duplicated session/AI logic):

- **Launcher** — a normal window for the dashboard, history, settings, and starting a
  new session.
- **HUD** — created automatically the moment a session starts. Frameless, transparent,
  always-on-top, and draggable/resizable (the OS window mirrors whatever you drag/resize
  the panel to). Closes back to the launcher when the session ends, from any window.

Global shortcuts (OS-wide, work even when another app has focus):
`Cmd/Ctrl+Shift+Space` show/hide, `+A` focus Ask AI, `+P` pause/resume, `+T` toggle
transcript, `+H` toggle presentation mode, `+M` move to the secondary display (keeps the
HUD's current size and its relative position on the new display; falls back to staying put
if only one display is connected), `+X` toggle click-through (lets clicks pass through to
whatever's behind the HUD — there's always a reliable shortcut to turn it back off). Esc is
intentionally *not* global — see the code comment in `electron/main.js` for why. A
tray/menu-bar icon gives the same controls plus Pause/Resume/End Session for when the HUD
is minimized or off-screen, and Settings has a "Reset Position" button for the same reason.

Platform capabilities (transparency support, etc.) are detected for real and shown
honestly in Settings — nothing is faked for platforms that don't support a feature.

**Presentation mode** — `Cmd/Ctrl+Shift+H`, the header's compact-Exit banner, or the
"Presentation mode" toggle in Settings shrinks the HUD to a small corner indicator and
turns on Focus Mode, so it never sits on top of whatever you're sharing. On desktop it can
also move the HUD to a chosen display (Settings → "Assistant display while presenting":
same/secondary/auto — `electron/main.js`'s `computePresentationBounds` picks the target
monitor and repositions the *existing* window; "secondary" falls back to the current
display if only one is connected). Turning it off restores whatever was showing before
(collapsed/focus-mode state is snapshotted on entry — see `usePresentationMode.ts`). Like
the rest of the HUD, this is a normal window resize/reposition: it does not hide the
assistant from screen shares, recordings, or any other capture — see the Boundary note
below.

If your dev server isn't on port 3000: `RTA_URL=http://localhost:PORT npm run desktop`.

**Speech recognition inside the HUD is a different code path, not the browser's**: Google
blocks the Web Speech API's server-side recognition backend for any non-Chrome embedder,
Electron included — confirmed by tracing macOS's own audio/TCC logs live during this
project's build (the microphone hardware activates fine; the failure is Chromium's
network upload to Google's speech service being rejected). No permission fix changes
this. Instead, the HUD automatically uses a separate path
(`useCloudTranscription.ts` → `/api/sessions/[id]/transcribe-chunk` → OpenAI Whisper,
reusing the same `OPENAI_API_KEY` and the same downstream ingestion pipeline as
everything else) — a few seconds of latency per chunk instead of Web Speech's
near-instant interim results, and it costs a small amount per minute of audio via the
OpenAI API. The browser tab keeps using the free, real-time Web Speech API as before.

**macOS microphone permission** (still required — the cloud path also needs real mic
access via `getUserMedia`): the prebuilt Electron binary `npm install` downloads is
ad-hoc signed with its Info.plist unbound from the signature, which stops macOS from
reliably prompting for (or even listing, in System Settings → Privacy & Security) camera/
microphone access — a known Electron/macOS packaging issue, not specific to this app.
`scripts/fix-electron-mac-signing.js` re-signs it locally and runs automatically via
`postinstall`, so this should already be handled after `npm install`. If the mic still
silently fails and "Electron" never appears in that Settings list, re-run it manually:
`node scripts/fix-electron-mac-signing.js`, then `tccutil reset Microphone
com.github.Electron` to clear any stuck permission state, then try again.

This is a dev-mode shell (`electron electron/main.js`), not a packaged, code-signed
`.app`/`.exe` — turning it into an installable distributable is a separate, platform-specific
step (electron-builder + signing certificates) that wasn't in scope here.

**Boundary**: the HUD is a normal, visible desktop window — it shows up in the window
list, Alt-Tab/Mission Control, and any screen share or recording, exactly like any other
app. It does not attempt to hide itself from screen capture, recording, or monitoring
software, and never will — see the design discussion in this project's history if you're
wondering why.

## Architecture

```
src/
  app/                    Pages (App Router) + API routes
  components/             UI components (session, dashboard, history, settings)
  hooks/                  useSpeechRecognition (browser), useCloudTranscription (Electron),
                          useSessionEvents (SSE client)
  lib/
    ai/
      llm/                Provider-agnostic LLM interface + OpenAI/mock implementations
      stt/                Provider-agnostic speech-to-text interface (OpenAI Whisper/mock)
      prompts/            System prompts (per mode) and task prompts, as standalone files
      context-engine.ts   Rolling context (short-term window + periodic summary compaction)
      question-detector.ts
      response-generator.ts
      schemas.ts          Zod schemas — the contract between the LLM and the UI
    services/              session/transcript/summary business logic
    events/session-bus.ts  In-memory pub/sub feeding the SSE stream
    context/                Modular ContextProvider interface (IDE/browser/terminal/screen)
    floating/               Floating-panel layout math, prefs, desktop-capability types
    db/prisma.ts
  hooks/useDesktopShell.ts  Renderer-side wrapper around window.desktopShell (no-ops on web)
prisma/schema.prisma        Data model
electron/                   Desktop shell — launcher + HUD windows, tray, global shortcuts,
                             multi-monitor recovery (main.js); secure IPC bridge (preload.js)
```

Swapping the LLM or STT provider only touches `lib/ai/llm/` or `hooks/useSpeechRecognition.ts`
respectively — nothing else in the app depends on a specific vendor.

## Status

Phases 1–6 of the build are implemented and verified end to end: foundation, real-time
transcript, AI assistant, coding mode, session intelligence (history/summary), and
production hardening (automated tests, structured logging, security-scoped session
ownership, accessibility pass). A modular screen/code context provider (paste code,
terminal output, etc. mid-session) and a desktop always-on-top shell with a global
shortcut are also in. See the in-app Settings page for current provider/config status.

The Resume / Job Description upload on "Start New Session" accepts `.txt`, `.md`,
`.pdf`, and `.docx` — PDF and Word files are parsed server-side (`pdf-parse` and
`mammoth`, see `/api/parse-file`) since that can't be done in the browser; old-format
`.doc` isn't supported (save as `.docx` or paste the text into Context instead). The
floating panel's toolbar `⋯` menu has a "Clear history" action that wipes a session's
accumulated questions/answers (not the transcript, and not the session itself) so you
can keep going without the old Q&A cluttering the feed — it asks for confirmation first
since it's not undoable.

Not yet implemented: accounts/login UI (intentionally deferred — single local user for
now, schema is multi-user-ready), and packaged/code-signed desktop distributables (the
dev-mode Electron shell above covers always-on-top + global shortcut without that step).

Run `npm test` for the automated test suite.
