# Architecture

This document describes how Xora Code is built today (end of Phase 1) and where the Phase 2 agent layer plugs in. The full design and phase plan live in the spec: [docs/superpowers/specs/2026-10-25-xora-code-design.md](superpowers/specs/2026-10-25-xora-code-design.md).

## Process model

Xora Code is a [Tauri 2](https://v2.tauri.app/) app with two halves:

| Process          | Language            | Responsibilities                                                                    |
| ---------------- | ------------------- | ----------------------------------------------------------------------------------- |
| Core             | Rust (`src-tauri/`) | Window, native dialogs, file system access, Inbox persistence. Later: agent processes, terminal, watcher. |
| WebView (UI)     | React + TypeScript (`src/`) | Everything you see: layout, Explorer, Monaco, Inbox, command palette, chat.  |

The two talk only through Tauri IPC:

```
React component / Zustand store
        │  ipc.readFile(path)                 src/shared/lib/ipc.ts (typed wrappers)
        ▼
invoke("fs_read_file", { path })              @tauri-apps/api/core
        │  JSON over IPC
        ▼
#[tauri::command] fs_read_file                src-tauri/src/fs/commands.rs (thin, async)
        │
        ▼
fs::read_file(&Path)                          src-tauri/src/fs/mod.rs (domain logic, unit-tested)
        │  Ok(T) or AppError
        ▼
resolved Promise<T>, or rejected with the error message string
```

Rules that keep this boundary clean:

- **One typed entry point.** Components never call `invoke` directly. `src/shared/lib/ipc.ts` owns every command name and its TypeScript types (`DirEntry`, `Note`), mirroring the Rust structs (`serde(rename_all = "camelCase")`).
- **Thin commands.** `commands.rs` only adapts arguments and state; the logic lives in `mod.rs` and is tested without Tauri.
- **One error type.** Every command returns `AppResult<T>`. `AppError` (`src-tauri/src/error.rs`) wraps `io::Error`, `tauri::Error` and domain errors such as `NotesError`, and serializes as its message string, so the frontend always receives a plain string.
- **Async commands.** File IO never blocks the main thread; notes writes run on the blocking pool.
- **Capabilities.** The window may only use the permissions listed in `src-tauri/capabilities/default.json` (window controls, dialog, opener).

### Current IPC surface

| Command         | Wrapper              | Purpose                                                     |
| --------------- | -------------------- | ----------------------------------------------------------- |
| `fs_list_dir`   | `ipc.listDir`        | List one directory: folders first, case-insensitive, `.git` hidden |
| `fs_read_file`  | `ipc.readFile`       | Read a UTF-8 text file                                      |
| `fs_write_file` | `ipc.writeFile`      | Write a text file                                           |
| `notes_list`    | `ipc.notesList`      | Load the Inbox (missing file means empty)                   |
| `notes_save`    | `ipc.notesSave`      | Replace the whole Inbox atomically                          |

Native dialogs (folder picker) and window controls use the official Tauri plugins and the window API directly; they are not custom commands.

## Folder map

Generated from the repository tree (`node_modules`, `target`, `dist`, `.superpowers` and `.claude` excluded; icons collapsed).

```
.
├── .github/workflows/ci.yml       CI: npm run check, build, cargo fmt/clippy/test (Windows)
├── assets/brand/                  Source logo (SVG) and icon render script
├── docs/
│   ├── architecture.md            This file
│   └── superpowers/specs/         Design spec and phase plan
├── index.html                     Vite entry HTML
├── src/                           Frontend (WebView)
│   ├── main.tsx                   React root, global styles
│   ├── app/                       App shell
│   │   ├── App.tsx                Layout + command palette toggle
│   │   ├── Layout.tsx             Three resizable panels (sidebar | chat | editor), persisted sizes
│   │   ├── TopBar.tsx             Custom frameless title bar
│   │   ├── WindowControls.tsx     Minimize / maximize / close
│   │   ├── ActivityBar.tsx        Explorer ↔ Inbox switch, Ctrl+Shift+E / N
│   │   ├── uiStore.ts (+test)     Sidebar view, persisted in localStorage
│   │   └── useWindowState.ts      Maximized state for the title bar
│   ├── features/
│   │   ├── chat/                  Chat surface placeholder: ChatPanel, ChatWelcome, Composer, composerKeys
│   │   ├── commands/              Command palette: registry, fuzzy (Turkish folding), results, shortcut hook, events
│   │   ├── editor/                Monaco: EditorArea (lazy), EditorPanel, tabs, status bar, store, save/close
│   │   │   └── monaco/            Local workers and the xora-onyx theme
│   │   ├── files/                 Explorer: FileTree, treeModel (keyboard nav), useTreeState, useFileOpener, latestGate
│   │   ├── inbox/                 Inbox: panel, composer, note item, store (debounced save, retry), flush on close
│   │   └── workspace/             Workspace root store and the open-folder dialog
│   ├── shared/
│   │   ├── lib/                   ipc.ts (typed IPC), path.ts
│   │   └── ui/                    Button, IconButton, Kbd, EmptyState, PanelHeader, cn, keys
│   └── styles/globals.css         Design tokens (@theme) and base styles
└── src-tauri/                     Rust core
    ├── Cargo.toml
    ├── tauri.conf.json            Window config (frameless), bundle settings
    ├── capabilities/default.json  Permissions granted to the main window
    ├── icons/                     App icons
    └── src/
        ├── main.rs                Binary entry, calls lib::run
        ├── lib.rs                 Builder: plugins, managed state, command registration
        ├── error.rs               AppError / AppResult
        ├── fs/                    mod.rs (list, read, write) + commands.rs
        └── notes/                 mod.rs (Note, atomic load/save) + commands.rs (NotesLock)
```

Each frontend feature co-locates its components, its Zustand store, pure logic and the tests for that logic. Each Rust domain is a module folder with `mod.rs` and `commands.rs`.

## Data flows

### Open a file

1. `openFolder()` shows the native folder picker (`@tauri-apps/plugin-dialog`) and stores the path in the workspace store.
2. `FileTree` calls `ipc.listDir(root)`; each folder is listed only when it is first expanded (lazy loading).
3. Clicking a file, or pressing `Enter` on it, calls `useFileOpener().open(path)`. If the tab is already open it just becomes active. Otherwise `ipc.readFile(path)` runs; a `latestGate` drops a slow read that finishes after a newer click, so it never steals the active tab. Read errors are kept per path and shown in the tree.
4. `useEditorStore.openFile(path, content)` adds the tab. The first tab triggers the lazy import of `EditorPanel`, which loads Monaco from the local bundle and registers the `xora-onyx` theme.

### Save a file

1. Edits update the tab's `content` in the editor store; a tab is dirty while `content` differs from the last saved content.
2. `Ctrl+S` (inside Monaco, anywhere in the window, or "save" from the command palette via a window event) calls `saveActiveTab()`.
3. `saveActiveTab` calls `ipc.writeFile(path, content)`, then `markSaved` clears the dirty state. A failure is returned as a value and shown inline; the tab stays dirty.

### Inbox persistence

1. On startup `ActivityBar` triggers `useInboxStore.load()`, which calls `notes_list`. The file is `notes.json` in the app data directory. A missing file is an empty inbox; a corrupt file is reported and never overwritten.
2. Every change (add, edit, pin, done, delete, undo) updates the store and schedules a save 300 ms later (debounce).
3. One save runs at a time. Changes made while a save is in flight are picked up by the same loop right after. A failed save keeps the notes in memory, shows the error, and retries with backoff (2 s, 5 s, 15 s, then every 30 s).
4. In Rust, `notes_save` takes `NotesLock` and writes on the blocking pool: serialize, write `notes.json.tmp`, `sync_all`, then rename over `notes.json`. A crash never leaves a half-written file.
5. `useFlushOnClose` hooks the window's close request: it commits any open inline edit and awaits `flushNow()` (capped at 3 s so a hung save never blocks closing).

## Where Phase 2 plugs in

Phase 2 connects real agents over the [Agent Client Protocol (ACP)](https://agentclientprotocol.com/). The official CLIs run as child processes and speak JSON-RPC over stdio; users sign in through each CLI's own login flow, so Xora Code never handles tokens or API keys.

| Piece                          | Location (planned)                         | Role                                                                                      |
| ------------------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `AgentBackend` trait           | `src-tauri/src/agents/mod.rs`              | `start`, `prompt`, `cancel`, event stream. Abstract, so a built-in API-key agent can be added later without UI changes. |
| ACP client                     | `src-tauri/src/agents/acp.rs`              | Spawns the adapter process, runs JSON-RPC over stdio.                                     |
| Registry                       | `src-tauri/src/agents/registry.rs`         | Claude Code, Codex and Gemini CLI definitions; detects whether each CLI is installed.     |
| Permissions                    | `src-tauri/src/permissions.rs`             | File-write and command-run approval requests, sent to the UI as events.                   |
| File watcher                   | `src-tauri/src/fs/`                        | Pushes on-disk changes to the tree and open editors.                                      |
| Workspace sandbox              | `src-tauri/src/fs/`                        | Restricts fs commands to the open workspace. Today `fs_*` accept any path the user can reach. |
| Chat UI                        | `src/features/chat/`                       | Messages, streaming, tool-call cards, approve / reject buttons, agent picker.             |
| Diff review                    | `src/features/editor/`                     | Accept or reject agent edits in a Monaco diff view.                                       |

The data flow follows the same IPC pattern, plus events from Rust to the UI:

```
UI ── ipc.agentPrompt(...) ──▶ agents::commands ──▶ AgentBackend (ACP child process)
UI ◀── "agent://event" ─────── text delta, tool call, file diff, permission request
UI ── approve / reject ──────▶ permissions ──▶ agent continues
```

New commands follow the existing rules: a `commands.rs` per module, `AppError` for failures, and typed wrappers (and event listeners) in `src/shared/lib/ipc.ts`.
