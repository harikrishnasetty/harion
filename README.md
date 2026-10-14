# Harion — Floating AI Capture Assistant

A futuristic, always-on-top orb that lives on your desktop. Tap it, drop text into it, and
Harion files what you captured into the right bucket automatically — **To-Do, Reminder,
Knowledge, Idea, Contact, or Link** — using a local LLM (Ollama) with a built-in rule engine
as a fallback when the model isn't available.

Everything is stored locally in SQLite. Nothing leaves your machine.

---

## Features

- **Floating neon orb** — translucent, always-on-top, draggable, with idle/pulse animations.
- **Quick capture panel** — click the orb (or press a hotkey), type anything, hit Enter.
  A live preview shows how Harion is about to classify it *before* you commit.
- **Four capture channels**
  - Global-hotkey quick text capture
  - Clipboard capture (text **or** image)
  - Screenshot **region** capture (drag a rectangle, it's cropped and stored)
  - Drag & drop text, URLs, or files onto the window
- **Automatic classification** into 6 collections + a generic note bucket, with tags,
  priority, and parsed due dates (`"tomorrow at 5pm"`, `"next friday"`, `"in 2 hours"`…).
- **Reminders** — items with a due date fire native desktop notifications.
- **Inbox / Collections / Completed / Archive** views, full-text-ish search, and an
  editable detail pane where you can fix anything the AI got wrong and re-run classification.
- **Tray icon**, single-instance lock, launch-at-startup, and configurable hotkeys.

---

## Requirements

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ (22 tested) | `node -v` |
| npm | 9+ | |
| Ollama | optional | For AI classification. Without it, Harion uses its rule engine. |

### Enabling local AI (optional but recommended)

1. Install [Ollama](https://ollama.com).
2. Pull a small instruct model:
   ```powershell
   ollama pull llama3.2
   ```
3. Make sure Ollama is running (`ollama serve` / the desktop app).
4. In Harion → **Settings → Local AI**, confirm the endpoint
   (`http://127.0.0.1:11434`) and model, then hit **Reconnect**.

If Ollama is offline, Harion degrades gracefully to its rule-based classifier — the app
always works.

---

## Getting started

```powershell
# from the project root
npm install          # also rebuilds the native SQLite module for Electron
npm run icons        # (already done) regenerates resources/icon.png + tray icons
npm run dev          # hot-reload dev mode
```

### Production build & packaging

```powershell
npm run build        # typechecks + bundles main / preload / renderer into out/
npm run preview      # run the built app
npm run dist         # build a Windows NSIS installer into release/
```

---

## Global hotkeys (defaults)

| Action | Shortcut |
|--------|----------|
| Quick capture (focus the orb panel) | `Ctrl+Shift+Space` |
| Capture the clipboard | `Ctrl+Shift+V` |
| Capture a screen region | `Ctrl+Shift+S` |
| Show / hide the main window | `Ctrl+Shift+N` |

Inside the capture panel: `Enter` files it, `Shift+Enter` adds a newline, `Esc` collapses.
During region capture: drag to select, `Enter` confirms, `Esc` cancels.

---

## How classification works

Captured text is sent to `POST {ollamaUrl}/api/chat` with a strict JSON schema prompt that
asks for `kind`, `title`, `summary`, `tags`, `priority`, `dueAt`, `confidence`, detected
`entities`, and `suggestedActions`. Relative dates are resolved against your local clock.

If the model is unreachable or returns garbage, `src/main/ai/rules.ts` classifies the text
with keyword rules, URL/email/phone extraction, and a natural-language date parser.

---

## Project structure

```
src/
  shared/          Types + IPC channel contract (shared by main, preload, renderer)
  main/            Electron main process
    db/            SQLite (better-sqlite3): schema, repositories, settings
    ai/            Ollama client, rule engine, classifier orchestration
    capture/       Clipboard, screenshot region, ingest pipeline
    util/          Paths, logger
    windows.ts     Orb / main / overlay window management
    tray.ts        System tray
    shortcuts.ts   Global hotkeys
    reminders.ts   Due-date scheduler + notifications
    ipc.ts         All ipcMain handlers
    index.ts       App lifecycle
  preload/         contextBridge API surface (window.harion)
  renderer/        React + TypeScript UI
    src/routes/    OrbView, MainView, OverlayView
    src/components/
    src/styles/    Hand-crafted futuristic CSS (glass + neon, no CSS framework)
resources/         Generated app + tray icons
```

---

## Data & privacy

- Database: `%APPDATA%\Harion\harion.db` (SQLite, WAL mode)
- Screenshots: `%APPDATA%\Harion\attachments\`
- Application icons/attachments are served to the renderer through a locked-down
  `harion-attach://` protocol; the renderer never gets raw filesystem access.
- No telemetry, no network calls except to your own Ollama endpoint.

---

## Roadmap ideas

- Voice capture (hold-to-talk) with Whisper
- Optional Markdown vault export (Obsidian-friendly)
- Semantic search + duplicate detection
- Editable hotkeys from the Settings screen
- Cloud model providers behind the same classifier interface

---

## License

**Harion Permission-Required Source License** — see [LICENSE](LICENSE).

This project is **source-available, not open source**. You are welcome to read and study
the code, but you may **not run or use it on any machine (including your own laptop)**
without the author's prior written permission.

To request permission, contact **Hari Krishna Setty** — https://github.com/harikrishnasetty

Copyright (c) 2026 Hari Krishna Setty. All Rights Reserved.
