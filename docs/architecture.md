# Architecture

This document describes how Xora Code is put together today: the process model, the Rust core, the frontend, the IPC surface, the main data flows, the trust boundaries and the folder map. Every name in it exists in the code; if you find one that does not, the document is wrong and a fix is welcome.

## Process model

Xora Code is a [Tauri 2](https://v2.tauri.app/) app with two halves, plus the child processes the core starts and owns.

| Process                | Language                        | Responsibilities                                                                                                                                     |
| ---------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core                   | Rust (`src-tauri/`)             | Window, single instance, file system, file watcher, find in files, Inbox and settings persistence, git, PTY terminals, the agent core (ACP client).  |
| WebView (UI)           | React + TypeScript (`src/`)     | Everything you see: sidebar, chat, Monaco editor and diff tabs, Changes panel, terminal dock, Settings, command palette, quick open, find in files.  |
| Agent adapters         | Node.js (child of the core)     | One process per agent kind (Claude Code, Codex, Gemini CLI), started as `node <entry>`, speaking newline-delimited JSON-RPC (ACP) over stdin/stdout. |
| Agent terminal command | any (child of the core)         | Commands an agent runs through ACP `terminal/create`, on plain pipes (not a PTY), killed with their process tree.                                    |
| Shells                 | any (child of the core, in PTY) | The integrated terminal: one shell per tab, through `portable-pty`.                                                                                  |
| `git`                  | `git` binary (short-lived)      | Status, stage, diff, commit, push/pull, worktrees, and the file list for quick open and search. Always `git -C <dir>`, never a library.              |

The core and the WebView talk only through Tauri IPC. A real command, end to end (committing from the Changes panel):

```
CommitBox -> useChangesStore.commit(message)   src/features/git/changesStore.ts
        │  gitIpc.commit(dir, message)          src/features/git/ipc.ts (typed wrapper)
        ▼
invoke("git_commit", { dir, message })          @tauri-apps/api/core
        │  JSON over IPC
        ▼
#[tauri::command] git_commit                    src-tauri/src/git/commands.rs (thin, async,
        │                                       runs the job on the blocking pool)
        ▼
git::changes::commit(&Path, &str)               src-tauri/src/git/changes.rs (logic, unit-tested)
        │  Ok(short id) or GitError
        ▼
resolved Promise<string>, or rejected with "[nothing_staged] nothing is staged to commit";
describeChangesError() turns the [code] into a translated message
```

Rules that hold at this boundary:

- **Typed wrappers, per feature.** Components never call `invoke`. Each feature that talks to Rust has an `ipc.ts` with typed wrappers (`features/agents`, `git`, `search`, `settings`, `terminal`); the shared file, Inbox and hostname commands are in `src/shared/lib/ipc.ts`. Three small modules own their commands directly instead: `features/files/fileIndex.ts` (`fs_list_files`), `features/git/worktrees.ts` (`git_worktree*`) and `features/workspace/fsWatch.ts` (`fs_watch`, `fs_unwatch`). TypeScript types mirror the Rust structs, which serialize with `serde(rename_all = "camelCase")`.
- **Thin commands.** `commands.rs` adapts arguments and state; the logic lives in the module's other files and is tested without Tauri.
- **Errors are strings.** A rejected promise always carries a plain string. Most commands return `AppResult<T>`; `AppError` (`src-tauri/src/error.rs`) wraps `io::Error`, `tauri::Error`, `NotesError`, `SettingsError` and `GitError` and serializes as its message. The agent commands return `Result<T, String>` and the terminal commands `Result<T, TerminalError>`, which also serialize as a message.
- **Error codes.** Where the UI explains an error in its own words, the message starts with a code: `[not_found] …`, `[binary] …`, `[bad_regex] …`, `[no_upstream] …`. The UI parses it with a `^\[([a-z_]+)\]` match (`parseFsError`, `describeChangesError`, `describeGitError`, `describeSearchError`). Agent errors use the prefix `auth_required:` instead (`AgentError::ipc_message`, `isAuthRequired`).
- **Async commands.** Commands are `async`, and disk work and `git` run on the blocking pool (`spawn_blocking`), so the main thread does not wait on them. The one exception is `system_hostname`, a synchronous command (on macOS it runs `scutil` when `HOSTNAME` is not set).
- **Streams, not polling.** Long-lived output reaches the UI three ways: the global event `fs://changed`, the `Channel` passed to `agents_subscribe` (every agent event), and the two `Channel`s passed to `term_spawn` (raw output bytes, exit code).

## Rust core

`src-tauri/src/lib.rs` builds the app: the single-instance plugin (first, so a second launch only focuses the window), the dialog and opener plugins, the managed state, the window-event hook and the `invoke_handler` with every command. On `RunEvent::Exit` (for example Cmd+Q on macOS, which skips the window close request) it shuts down the agents and kills all terminals.

### `error`

`error.rs` defines `AppError` and `AppResult<T>`. Domain errors convert with `#[from]`. Serialized as the message string.

### `fs`

| File          | Owns                                                                                                                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mod.rs`      | `list_dir` (folders first, case-insensitive, `.git` hidden), `read_file` (refuses folders and files over `MAX_READ_BYTES`, 16 MiB), `write_file`, `coded`.                                                             |
| `index.rs`    | `list_files`: the workspace's files for quick open, `@` mentions and search. `git ls-files -co --exclude-standard` in a repository, else a walk that skips build and dependency folders. At most `MAX_FILES` (50,000). |
| `search.rs`   | Find in files: literal, whole-word or regex, case folding that knows Turkish `İ`/`ı`, binaries and files over `MAX_FILE_BYTES` skipped, capped results, up to 8 threads.                                               |
| `watch.rs`    | One recursive `notify` watcher on the open root. A `Coalescer` batches raw events until 150 ms of quiet (`QUIET`) or 1 s (`MAX_WAIT`); over `MAX_PATHS` (500) paths the batch becomes a full refresh.                  |
| `commands.rs` | `fs_list_dir`, `fs_read_file`, `fs_read_bytes` (20 MB cap, for attached images), `fs_write_file`, `fs_list_files`, `fs_search`, `fs_search_cancel`, `fs_watch`, `fs_unwatch`.                                          |

- **Errors:** `coded` prefixes `io::Error`s with `[not_found]`, `[permission_denied]`, `[binary]`, `[too_large]` or `[is_dir]`; search adds `[bad_regex]`.
- **State:** `WatchState` (the active watcher), `SearchState` (a generation counter: a new search or `fs_search_cancel` makes the running one's `Ticket` cancelled, and it resolves as `{ status: "cancelled" }`).
- **Events:** `fs://changed` with `{ root, paths, full }` (`CHANGED_EVENT`). Changes inside `.git` are ignored.
- **Also here:** `focus_main_window`, called by the single-instance plugin.

### `notes`

The Inbox. `mod.rs` has `Note`, `load` (missing file is an empty list, a corrupt file is an error and is left untouched) and `save` (write `notes.json.tmp`, `sync_all`, rename). `commands.rs` has `notes_list` and `notes_save`; `NotesLock` serializes access and the IO runs on the blocking pool. File: `notes.json` in the app data folder. No events.

### `settings`

Every persisted preference (`general`, `agent`, `editor`, `terminal`, `appearance`, and the shortcut overrides in `keybindings`) in `settings.json` in the app data folder.

- `mod.rs`: the `Settings` struct with defaults; `from_value` keeps each valid field and falls back to the default per field, so a typo never resets the rest; `apply_patch` deep-merges a JSON patch and sanitizes it; `load` moves invalid JSON aside to `settings.json.corrupt` (earlier ones shift to `.corrupt.1` … `.corrupt.4`, `CORRUPT_BACKUPS` in all) and returns defaults; `save` is atomic like the notes.
- `keybindings.rs`: the shortcut overrides, action id to a binding in canonical form (`"mod+shift+g"`) or `null` for unbound. `sanitize` drops unknown action ids (`ACTION_IDS`, mirrored from the UI's keymap and checked by a test) and unreadable bindings one entry at a time; a patch replaces the map whole.
- `wallpaper.rs`: copies a picked image into `<app data>/wallpapers/` (`WALLPAPER_DIR`, 40 MB cap, image extensions only) and removes old ones.
- `commands.rs`: `settings_get`, `settings_update` (returns the sanitized result), `settings_wallpaper_import`, `settings_wallpaper_remove`. `SettingsLock` serializes read-modify-write. `commands::read` lets other modules read settings; the agent core uses it at spawn time.
- **Errors:** `SettingsError` messages, no codes. **Events:** none; the UI owns the live copy.

### `terminal`

The integrated terminal. `mod.rs` picks the shell (`resolve_shell`, `shell_for`, `configured_shell`) and the working directory; `session.rs` has `TerminalManager`, which owns each PTY, a reader thread that streams output and a waiter thread that reaps the shell and reports the exit code. `commands.rs` has `term_spawn`, `term_write`, `term_resize`, `term_kill`, and `on_window_event`, which kills every session when the window is destroyed.

- **Shells:** Windows uses PowerShell 7 (`pwsh`) when on the PATH, else Windows PowerShell; Settings can pick `pwsh`, `powerShell`, `cmd` or `gitBash` (found next to `git.exe`, never WSL's `bash.exe`). Elsewhere it is `$SHELL -l`, else `/bin/sh`. Sessions get `TERM=xterm-256color`, `COLORTERM=truecolor`, `TERM_PROGRAM=XoraCode`.
- **Errors:** `TerminalError`, serialized as its message. **Streams:** the `on_data` and `on_exit` channels of `term_spawn`; no global events.

### `git`

Everything goes through the `git` binary with `GIT_TERMINAL_PROMPT=0`, `GIT_LITERAL_PATHSPECS=1`, `LANGUAGE=en` and no console window.

| File          | Owns                                                                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mod.rs`      | The runner, `GitError`, and worktrees for agent chats: `list`, `create` (branch under `BRANCH_PREFIX`, `xora/`, in `<app data>/worktrees/`), `merge`, `remove`.                   |
| `status.rs`   | `status`: branch, upstream, ahead/behind and entries from `git status`, capped at `MAX_ENTRIES` (5,000).                                                                          |
| `changes.rs`  | `stage`, `unstage`, `discard`, `diff` (capped at `MAX_DIFF_BYTES`), `commit`, `push`, `pull --ff-only`, `classify_remote`. Every path goes through `checked` (relative, no `..`). |
| `show.rs`     | `show`: a file's text at HEAD or in the index, refusing binaries and files over `MAX_SHOW_BYTES`.                                                                                 |
| `deadline.rs` | `output_with_deadline`: runs a command with a time limit and kills its whole process tree (a Job Object on Windows, a process group elsewhere) when it expires.                   |
| `commands.rs` | The 13 `git_*` commands, each on the blocking pool.                                                                                                                               |

- **Errors:** every `GitError` message carries a code: `[not_repo]`, `[nothing_staged]`, `[no_identity]`, `[auth]`, `[offline]`, `[rejected]`, `[diverged]`, `[no_upstream]`, `[timeout]`, and so on; `[git]` carries git's own text.
- **Remote timeout:** push and pull run through `git_within` with `REMOTE_TIMEOUT` (120 s), so an SSH passphrase prompt or a stalled network ends as `[timeout]` instead of hanging the panel.
- **State and events:** none.

### `accounts`

Detects the agent CLIs for Settings > Accounts. `Env::detect` finds the binary on the PATH and in common install folders, runs `--version` (3 s timeout) and decides the sign-in state from whether the CLI's credential file exists (`Provider::credential_file`); the file is never opened. `open_login` opens the CLI's own sign-in in a new terminal window (`cmd` on Windows, Terminal.app on macOS). Commands: `accounts_detect`, `accounts_login`. Errors through `AppError`; no state, no events.

### `agents`

The ACP client. One adapter process per agent kind, many sessions per process.

| File                  | Owns                                                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registry.rs`         | `SPECS`: the three adapters, their npm package, pinned version and minimum Node.js; `find_node`; why an agent is not installed.                                 |
| `install.rs`          | Installs the pinned package with the user's own `npm` into `<app data>/agents/<slug>/<version>`.                                                                |
| `process.rs`          | `spawn`, `hide_console`, `JobObject` (kill-on-close Job Object on Windows, process group elsewhere), `StderrTail` and `mask_secrets`.                           |
| `transport.rs`        | JSON-RPC 2.0 over stdio: `RpcPeer` for outgoing requests, `IncomingHandler` for notifications (in order) and requests. Lines over `MAX_LINE_BYTES` are dropped. |
| `manager.rs`          | `AgentManager`, the managed state: starts adapters (`launch_spec`, `initialize_params`), opens sessions, sends prompts, routes incoming requests, emits events. |
| `session.rs`          | `SessionRegistry`: per-session agent, `cwd`, allowed `roots` and whether a turn is running.                                                                     |
| `acp.rs`, `bridge.rs` | The `ClientHandlers` trait and `Bridges`, its implementation: ACP `fs/*` and `terminal/*` for the agent, plus the review store.                                 |
| `fs_bridge.rs`        | The workspace sandbox for agent file access (see Security).                                                                                                     |
| `terminal_bridge.rs`  | ACP terminals: commands on pipes, output kept to a byte limit (1 MiB default), streamed to the UI in batches.                                                   |
| `permissions.rs`      | `PermissionBroker`: an open `session/request_permission` waits on a oneshot until the UI answers or the turn is cancelled.                                      |
| `review.rs`           | `ReviewStore`: per turn, each changed file's content before the first change and after the last, for revert.                                                    |
| `fork.rs`             | "Edit and retry": the `session/fork` request cut at a message, and which adapter versions were checked to honour the cut (`FORK_POINT_ADAPTERS`).              |
| `index.rs`            | `SessionIndex`: `<app data>/agents/sessions.json` with titles, pins, archive and delete marks, merged with the agent's `session/list`.                          |
| `events.rs`           | `AgentEvent`, `AgentStatus`, `SessionSetup`, `EventSink`. Mirrored by `src/features/agents/types.ts`; change both together.                                     |
| `commands.rs`         | The 25 `agent_*` / `agents_*` commands, thin wrappers around `AgentManager`.                                                                                    |

- **Errors:** `AgentError`, sent as a string; ACP error `-32000` becomes `auth_required:<message>`.
- **Events:** everything goes through `EventSink` to the `Channel` the UI passes to `agents_subscribe`. The `type` tag is one of `agentStatus`, `sessionUpdate` (the raw ACP update, passed through), `permissionRequested`, `permissionResolved`, `turnEnded`, `turnFailed`, `fileWritten`, `terminalOutput`, `terminalExited`. Events sent before a subscriber exists are dropped; the UI re-reads state with `agents_list`.
- **Process lifetime:** adapters start in the user's home folder (a session folder could not be deleted while a process sits in it), each in a Job Object or process group. `agents_shutdown` (from the UI's close guard) and `RunEvent::Exit` stop them.

### `system`

`system.rs`: `system_hostname` (the computer name shown above the composer, or `null` when there is none; the UI then shows its translated "This computer") and `adopt_login_shell_path`, which on macOS reads the login shell's `PATH` at startup (5 s limit) so `node` and `git` from Homebrew, nvm or Volta are found when the app is opened from Finder.

## Frontend

### App shell (`src/app/`)

| File                                                       | Role                                                                                                                                                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App.tsx`                                                  | Installs the app-wide hooks before the first render (`installLanguage`, `installWindowLook`, `installUiPrefs`, `installAutoSave`, …), owns the overlays (palette, quick open, find in files) and mounts `useAgentEvents`. |
| `Layout.tsx`                                               | Resizable panels: sidebar, chat, editor and the terminal dock, with the files drawer and Settings host.                                                                                                                   |
| `Sidebar.tsx`                                              | Conversations, Inbox and Changes views; loads the Inbox on start.                                                                                                                                                         |
| `MainBar.tsx`                                              | The title strip over the chat: conversation title, panel toggles, export.                                                                                                                                                 |
| `FilesDrawer.tsx`                                          | The file tree in a drawer; always mounted, because the tree runs the workspace lifecycle.                                                                                                                                 |
| `WindowControls.tsx`, `useWindowState.ts`                  | Window buttons for the frameless window; on macOS `NATIVE_CAPTION` hides them for the native traffic lights.                                                                                                              |
| `closeGuards.ts`                                           | `registerCloseGuard`: work that must finish before the window closes, run in parallel, capped at `CLOSE_GUARD_TIMEOUT_MS` (3 s).                                                                                          |
| `uiStore.ts`, `uiPrefs.ts`, `windowLook.ts`, `language.ts` | Sidebar view and drawer state, zoom and chat text size, window transparency effects, interface language.                                                                                                                  |

### Features (`src/features/`)

Each feature folder co-locates its components, its Zustand store, pure logic, and a `*.test.ts` next to each piece of pure logic. Typed IPC sits in the feature's `ipc.ts`.

| Feature     | Role                                                                                                                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `agents`    | Agent state without UI: `store.ts` (`useAgentStore`), `reducer.ts` (`reduceEvents`, pure), `types.ts` (mirror of `events.rs`), `ipc.ts`, defaults, attention, the session reaper, fixture mode.                                                                                |
| `chat`      | The conversation UI: `ChatPanel`, `Composer`, `MessageList`, `ToolCallCard`, `ToolRunGroup` (runs of tool calls folded into one row, `toolRuns.ts`), `PermissionPrompt`, `ChangesBar`, `SessionList` with each conversation's status (`sessionStatus.ts`), Markdown rendering. |
| `editor`    | Monaco: `EditorArea`, `EditorPanel` (lazy), tabs, read-only diff tabs (`DiffView`, `tabKind.ts`), `store.ts`, save, auto save, disk sync. `monaco/` holds the local worker setup, the `xora-onyx` theme and the generated slim entry.                                          |
| `files`     | Explorer: `FileTree`, `treeModel`, `useTreeState`, `useFileOpener`, `QuickOpen`, `fileIndex.ts`, `fsErrors.ts`, `latestGate.ts`.                                                                                                                                               |
| `git`       | The Changes panel (`ChangesPanel`, `CommitBox`, `BranchBar`, `changesStore.ts`, `useChangesSync.ts`), "open diff" for a row, and worktrees for agent chats (`worktrees.ts`).                                                                                                   |
| `search`    | Find in files: `FindInFiles`, `SearchResults`, `searchStore.ts`, `searchModel.ts`, `ipc.ts`.                                                                                                                                                                                   |
| `terminal`  | `TerminalDock`, `TerminalPanel`, `TerminalView`, `session.ts` (`TerminalSession`, one xterm per PTY), tabs, write queue, theme.                                                                                                                                                |
| `settings`  | `SettingsView` and its sections, form controls, `store.ts` (`useSettingsStore`), the accounts store, settings search, shortcuts.                                                                                                                                               |
| `inbox`     | Notes: `InboxPanel`, `NoteComposer`, `NoteItem`, `store.ts` (debounced save with retry), `useFlushOnClose`.                                                                                                                                                                    |
| `workspace` | The open folder: `store.ts`, `openFolder.ts`, recents, restoring tabs, `fsWatch.ts`, `useWorkspaceLifecycle.ts`.                                                                                                                                                               |
| `commands`  | Command palette: `registry.ts`, `dynamic.ts` (conversations and folders), `fuzzy.ts` (Turkish folding), `events.ts` (command bus), shortcut hooks, `paletteGuard.ts`.                                                                                                         |
| `keymap`    | The app-level shortcuts: `actions.ts` (bindable actions, default bindings, scopes), `binding.ts` (parse, format, match), `keymap.ts` (effective keymap, `matchesAction`, `resolve`, Monaco keybindings), `capture.ts` (recording, reserved keys, conflicts), `captureGuard.ts`, `settingsSync.ts`. |
| `backdrop`  | The wallpaper behind a new chat and the readability scrim behind a conversation (`effects.ts`, `scrim.ts`).                                                                                                                                                                    |
| `updates`   | The once-a-day "newer release?" check: `version.ts` (parse, compare), `releaseCheck.ts` (when to ask, the GitHub request, reading the answer), `saved.ts` (last check, latest release seen, dismissed version in `localStorage`), `store.ts`, `updateCheck.ts` (`installUpdateCheck`), `UpdateNotice`. A notice only; nothing is downloaded. |

### Shared (`src/shared/`)

- `i18n/`: `t()`, `msg()`, the Turkish catalog `tr.ts` and its test.
- `lib/`: `ipc.ts` (file, Inbox and hostname wrappers), `path.ts`, `contrast.ts`, `ime.ts`, `autoGrow.ts`, `useHostname.ts`. Framework-free helpers.
- `ui/`: primitives (`Button`, `IconButton`, `Dialog`, `ConfirmDialog`, `ContextMenu`, `Kbd`, `EmptyState`, `PanelHeader`, `ErrorBoundary`, `cn`) and their pure logic (`focusTrap.ts`, `keys.ts`, `menuModel.ts`, `modalGuard.ts`).

`shared/` never imports from `features/` or `app/`.

### Styles

`src/styles/globals.css` defines the design tokens in Tailwind v4's `@theme` and the base styles; components use the generated utilities. Two features add their own CSS: `chat/chat.css` and `terminal/terminal.css`.

### Shortcuts: from key press to action

Every app-level shortcut is an action in `features/keymap/actions.ts` with its default bindings (`mod+k`, `ctrl+shift+g`, `alt+f5`; `mod` is Ctrl on Windows and Linux and Cmd on macOS, `ctrl` the Control key on every platform). The effective keymap is those defaults overlaid with `settings.keybindings`, kept in `useKeymap` by `installKeymap`, so a change in Settings > Shortcuts applies at once.

The handlers stay where they always were, with their own phase and guards: window or document capture listeners (palette, quick open, find in files, new chat, sidebar and its views, terminal, close tab, settings, interface scale, diff navigation), a bubble listener for save, the composer's own key handler for stop, and Monaco keybindings for the editor's add to chat and save (built with `monacoKeybindings` and registered again when the keymap changes). Each asks `matchesAction(event, id)` instead of naming keys. Letters and digits match the character typed, falling back to the physical key (`KeyboardEvent.code`) when the key types no Latin letter or digit; `` ` `` always matches the physical key, `+` and `-` ignore Shift. Two guards run first, both installed at module load in `App.tsx`: `captureGuard` hands every key to Settings while a row records a new binding, and `paletteGuard` swallows the close-tab, save and sidebar actions while the palette is open.

Deliberately not in the keymap: text editing in the composer (`chat/composerKeys.ts`), list and dialog navigation (arrows, Enter, Esc, Tab), Monaco's own bindings, terminal key handling (`terminal/keys.ts` clipboard keys, Ctrl+PageUp/PageDown), and dialog-local keys (Alt+C/W/R in find in files, Ctrl+Enter in the commit box, Ctrl+Z in the Inbox). Recording refuses typing keys without Ctrl/Cmd/Alt, reserved combinations (copy and paste, undo, find in file, devtools, Alt+F4, Cmd+Q …) and AltGr characters, and asks before taking a binding another action uses in an overlapping scope (`findConflict`).

### Fixture mode

`npm run dev` serves the UI in a plain browser, where no Rust command exists. In a DEV build, `?fixture=<scenario>` (`streaming`, `toolDiff`, `permission`, `plan`, `terminal`, `toolRun`; or `welcome` for no session) swaps the agent IPC for a fake (`setAgentIpc`) and plays a scripted turn through the real store and reducer; `&agent=codex` and `&status=crashed` pick the agent and its status; `&branch=1` sends a second message and then edits and retries it (a fork for Claude and Codex, the summary fallback for Gemini). `&update=0.9.0` shows the update notice for that version without any request. `?settings=<section>` opens Settings on that section; on `shortcuts`, `&keys=capture` or `&keys=conflict` seeds a row recording keys or holding a conflict (`settings/sections/shortcutsFixture.ts`). See `src/features/agents/fixtureMode.ts`. Production builds drop the fixture code.

## IPC surface

The authoritative list of commands is the `invoke_handler` in `src-tauri/src/lib.rs`. By domain:

| Prefix                                                          | Rust module            | Frontend wrapper                    | Covers                                                                                      |
| --------------------------------------------------------------- | ---------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `fs_list_dir`, `fs_read_file`, `fs_read_bytes`, `fs_write_file` | `fs/commands.rs`       | `src/shared/lib/ipc.ts`             | Explorer listing, reading and saving files, attached images                                 |
| `fs_list_files`                                                 | `fs/commands.rs`       | `src/features/files/fileIndex.ts`   | File index for quick open and `@` mentions                                                  |
| `fs_search`, `fs_search_cancel`                                 | `fs/commands.rs`       | `src/features/search/ipc.ts`        | Find in files                                                                               |
| `fs_watch`, `fs_unwatch`                                        | `fs/commands.rs`       | `src/features/workspace/fsWatch.ts` | The watcher behind `fs://changed`                                                           |
| `notes_`                                                        | `notes/commands.rs`    | `src/shared/lib/ipc.ts`             | Inbox load and save                                                                         |
| `system_`                                                       | `system.rs`            | `src/shared/lib/ipc.ts`             | Host name                                                                                   |
| `term_`                                                         | `terminal/commands.rs` | `src/features/terminal/ipc.ts`      | PTY spawn, write, resize, kill                                                              |
| `settings_`                                                     | `settings/commands.rs` | `src/features/settings/ipc.ts`      | Settings get and patch, wallpaper import and removal                                        |
| `accounts_`                                                     | `accounts/commands.rs` | `src/features/settings/ipc.ts`      | CLI detection, opening a CLI's sign-in                                                      |
| `agents_`, `agent_`                                             | `agents/commands.rs`   | `src/features/agents/ipc.ts`        | Event subscription, install, auth, sessions, prompts, modes and models, permissions, review |
| `git_status` … `git_pull`                                       | `git/commands.rs`      | `src/features/git/ipc.ts`           | The Changes panel                                                                           |
| `git_worktree*`, `git_worktrees`                                | `git/commands.rs`      | `src/features/git/worktrees.ts`     | Worktrees for agent chats                                                                   |

Native dialogs (folder and image pickers), opening links and window controls use the official plugins and the window API directly; they are not custom commands.

To add a command: write it in the module's `commands.rs`, register it in `lib.rs`, add the typed wrapper to the feature's `ipc.ts`, and give its errors a `[code]` if the UI needs to explain them.

## Key data flows

### Send a prompt and stream a turn

1. `ChatPanel`'s `submit` gets a session from `ensureSession` (which calls `useAgentStore.newSession` the first time), builds ACP content blocks with `toBlocks` (the text, pictures read with `ipc.readBytes` as image blocks, files and folders as resource links) and calls `useAgentStore.prompt`.
2. If a turn is already running, the prompt is queued. Otherwise `beginTurn` adds the user message and marks the session running, and `tauriAgentIpc.prompt` invokes `agent_prompt`.
3. `AgentManager::prompt` tells the review store a turn begins (`turn_started`), sends `session/prompt` on a spawned task and returns at once.
4. While the turn runs, each `session/update` notification is handed to `observe_update` (session titles, diffs for review) and emitted unchanged as a `sessionUpdate` event on the `agents_subscribe` channel.
5. In the UI, `ingest` queues events and `frameScheduler` flushes them once per animation frame through `reduceEvents`, which turns updates into chat items (message chunks, thoughts, tool calls, plans, usage).
6. When `session/prompt` returns, Rust emits `turnEnded` with the stop reason (or `turnFailed`), touches the session index, and the store sends the next queued prompt.

### Answer a permission request

1. The adapter sends `session/request_permission`. `handle_request` opens an entry in `PermissionBroker` and emits `permissionRequested` with the tool call and options; the agent's request stays open.
2. The reducer adds it to the session's `permissions`; `PermissionPrompt` shows it.
3. The user picks an option. `useAgentStore.respondPermission` removes it locally and invokes `agent_permission_respond` (it is put back if that fails).
4. `PermissionBroker::respond` completes the waiting request, the adapter receives `outcome_json` (`selected` with the option id), and Rust emits `permissionResolved`.
5. Cancelling the turn (`agent_cancel`), a crash or shutdown answers every open request as `cancelled`.

How often an agent asks is the agent's own mode: Settings' approval policy (`ask`, `autoEdits`, `full`) only picks the mode each new session starts in (`MODE_BY_POLICY` in `features/agents/defaults.ts`).

### Agent file edits, review, accept and revert

1. An agent that writes through ACP calls `fs/write_text_file`. `Bridges::write_text_file` resolves the path with `resolve_in_roots`, keeps the file's previous bytes, writes atomically (`write_text_atomic`), records both in `ReviewStore::record_write` and emits `fileWritten`.
2. An agent that writes files itself (Codex) reports ACP `diff` content on its tool calls; `PendingDiffs` holds them until the call completes and `ReviewStore::record_diff` records them.
3. The reducer collects the turn's changed files in the session's `changes`; `ChangesBar` lists them, and a row opens a read-only diff tab through `openDiffInEditor`. Starting the next turn empties the list (`beginTurn`), as the core drops the last turn's snapshots then (`begin_turn`). Reopening a session (`loadSession`) adds back the files the core still tracks (`agent_review_changes`), for example after a window reload.
4. "Accept" (`acceptChanges`) calls `agent_review_accept`, which drops the session's snapshots, and clears the list only once that succeeds; a failure keeps the list and shows the error. Snapshots also go when the session closes.
5. "Revert" calls `revertChange` → `agent_review_revert`. `ReviewStore::revert` restores the original (or deletes a file the turn created) only while the disk still holds what the agent wrote; otherwise it returns `conflict` and leaves the file alone.

### Edit and retry from an earlier message

1. The pencil on a user message (`MessageList`, offered while `canBranch`) calls `editAndRetry` (`chat/branchChat.ts`), which calls `useAgentStore.branchSession`.
2. `planBranch` finds the cut point: the `messageId` of the last agent message between that user message and the one before it (the reducer keeps the ids the adapters put on message chunks, live and on replay). `branchVia` picks `fork` when there is one and the agent advertises `sessionCapabilities.fork`, `new` for the first message, else `summary`.
3. `fork` invokes `agent_session_fork`. `AgentManager::session_fork` asks only adapters in `fork::FORK_POINT_ADAPTERS` and sends `session/fork` with the cut in `_meta.jetbrains.air.fork` (`fork_request`); the new session is registered like `session_new`. Any refusal falls back to `summary`: a plain `agent_session_new`.
4. The new chat opens next to the original, which is not changed. A fork shows the kept conversation; every branch gets the original's model, mode and effort, and quiet lines when it started from a summary or when later turns edited files.
5. `branchDraft` puts the message and its attachments back in the composer (`draftFromBlocks`), for the summary also the transcript before it (`branchPrompt`). Nothing is sent until the user sends it.

### Open, edit and save a file; follow the disk

1. `openFolder()` shows the native folder picker and stores the root; `useWorkspaceLifecycle` restores the last folder's tabs and calls `watchRoot(root)`, which invokes `fs_watch`.
2. `FileTree` lists folders lazily with `ipc.listDir`. Opening a file runs `useFileOpener().open(path)`: an open tab just becomes active; otherwise `ipc.readFile` runs behind a `latestGate`, so a slow read never steals the active tab. A missing file re-lists its folder; other errors stay on the row.
3. `useEditorStore.openFile` adds the tab; the first tab lazy-loads `EditorPanel` and Monaco from the local bundle.
4. `Ctrl+S` (or auto save) calls `saveTab` → `ipc.writeFile` → `markSaved`. A failure is kept as `saveError` and the tab stays dirty.
5. The watcher's `fs://changed` batch reaches `onFsChange` listeners. `useDiskSync` re-reads affected tabs (`syncTabFromDisk`): `applyDiskContent` reloads a clean tab, flags a dirty one with `diskChanged` instead of overwriting edits, and `markDiskChanged` flags a deleted file. Auto save never writes a flagged tab.

### Integrated terminal

1. Opening the dock (lazy `TerminalPanel`) or the new-terminal shortcut adds a tab to `useTerminalStore`; its view gets a `TerminalSession` (one xterm instance, kept outside React).
2. `TerminalSession` creates two `Channel`s and calls `terminalIpc.spawn` with the size, the workspace folder and Settings' shell.
3. `term_spawn` resolves the shell and folder, and `TerminalManager::spawn` starts it in a PTY; its reader thread sends raw bytes over the data channel, which xterm writes through a write queue.
4. Keystrokes go back with `term_write`; resizes with `term_resize`.
5. The shell's exit arrives once on the exit channel. Closing a tab calls `term_kill`; a close guard (`disposeAllSessions`) and `on_window_event` kill the rest when the window closes.

### Git Changes panel

1. `useChangesSync` points `useChangesStore` at the chat's checkout (`useActiveCheckout`: the session's folder, a selected worktree, or the open root) and refreshes on view open, window focus, the end of an agent turn and (debounced, `refreshSoon`) `fs://changed`. There is no polling.
2. `refresh` calls `gitIpc.status` → `git_status`; only one load runs at a time, and a request during it runs once more afterwards.
3. Stage, unstage, discard, commit, push and pull go through the store's `run`: one action at a time, failures become a notice via `describeChangesError`, then a refresh.
4. `git_commit` refuses an empty message, conflicts and an empty index before running `git commit`; it returns the short id.
5. `git_push` pushes, or publishes a branch without an upstream to `origin` (else the first remote) with `--set-upstream`. Push and pull have `REMOTE_TIMEOUT`; past it the process tree is killed and the panel shows `[timeout]`. Credentials come from git's own helpers; prompts are disabled.

### Find in files with cancellation

1. `Ctrl+Shift+F` opens `FindInFiles`, seeded from the editor selection. Typing calls `useSearchStore.request(root)`.
2. The request is debounced (`SEARCH_DEBOUNCE_MS`, 200 ms) and takes a `latestGate` token; if a search is running, `searchIpc.cancel` stops it at once.
3. `fs_search` takes a new `Ticket` from `SearchState`, which cancels any older one, and searches the file index on the blocking pool, checking the ticket as it goes.
4. A superseded search resolves as `cancelled` and is ignored; the gate also drops any late answer. Closing the dialog calls `stop`.
5. An invalid regex rejects with `[bad_regex]`, which `describeSearchError` shows inline.

### Settings: load, save, reach the UI

1. `ensureSettingsLoaded` (`useSettingsStore.load`) calls `settings_get` once; until it resolves, the store holds `DEFAULT_SETTINGS`.
2. `update(patch)` applies the patch in memory at once, merges it into the pending patch and saves after 300 ms (`SAVE_DELAY_MS`) via `settings_update`.
3. Rust deep-merges the patch into the file under `SettingsLock`, sanitizes it and returns the result, which the store adopts (re-applying anything queued meanwhile). A failed save keeps the change pending.
4. Consumers read the store: `installLanguage`, `installWindowLook`, `installUiPrefs`, the editor options, the terminal, the agent defaults (`setAgentSettingsSource`). Rust reads `agent.claudeIgnoreApiKey` and `agent.debugLogs` itself when it starts an adapter.
5. A close guard in `SettingsHost` flushes a pending save before the window closes.

### Inbox persistence

1. On startup `Sidebar` calls `useInboxStore.load()`, which calls `notes_list`. A missing `notes.json` is an empty inbox; a corrupt one is reported and never overwritten, because nothing is saved before a successful load.
2. Every change (add, edit, pin, done, delete, undo) updates the store and schedules a save 300 ms later.
3. One save runs at a time; changes made during it are written by the same loop right after. A failed save keeps the notes in memory and retries after 2 s, 5 s, 15 s, then every 30 s (`RETRY_DELAYS_MS`).
4. `notes_save` takes `NotesLock` and, on the blocking pool, writes `notes.json.tmp`, syncs it and renames it over `notes.json`.
5. `useFlushOnClose` registers a close guard that commits an open inline edit and awaits `flushNow()`, within the 3 s close-guard cap.

## Security and trust boundaries

Xora runs everything with the user's own permissions. What is and is not confined:

| Who                                                             | Can reach                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent, through ACP `fs/read_text_file` and `fs/write_text_file` | Only files inside the session's roots (today: the session's `cwd`). `resolve_in_roots` requires an absolute path, rejects `..`, resolves symlinks and junctions with `dunce::canonicalize` (also for files that do not exist yet), refuses dangling links, Windows device names and alternate data streams, and compares case-insensitively on Windows. Writes re-check the parent before the final rename. 16 MiB cap. |
| Agent, through ACP `terminal/create`                            | The working directory must be inside the roots. The command itself is not sandboxed: it runs with the user's rights and environment, plus any variables the agent passes.                                                                                                                                                                                                                                               |
| Agent adapter process                                           | Anything the user can. Reading, writing or running things inside the adapter's own process (as Codex does for its edits) does not go through Xora at all. Whether the agent asks first depends on its mode (see the permission flow).                                                                                                                                                                                   |
| `agent_review_revert`                                           | Re-checks the path against the roots, since diff paths come from the agent.                                                                                                                                                                                                                                                                                                                                             |
| The UI's own `fs_*` commands                                    | Any path the user can reach. They are not limited to the open workspace; the WebView is trusted.                                                                                                                                                                                                                                                                                                                        |
| The UI's `git_*` commands                                       | Any directory; file paths must be relative and stay inside the repository (`checked`).                                                                                                                                                                                                                                                                                                                                  |

Credentials:

- Xora asks for no API keys and stores no tokens. Each CLI signs in through its own flow (`accounts_login`, `agent_authenticate`, `agent_auth_terminal`).
- `accounts` only checks whether a CLI's credential file exists; it never opens it.
- By default (`agent.claudeIgnoreApiKey`) Claude's adapter starts without `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN`, so it uses the subscription login. Other environment variables are inherited.
- Git push and pull use git's own credential helpers; `GIT_TERMINAL_PROMPT=0` turns a would-be prompt into an `[auth]` error.

Secret masking: `mask_secrets` masks token-like text (`sk-`, `Bearer `, `ya29.`, `ghp_`, `AIza`, and values after `API_KEY`, `AUTH_TOKEN`, `access_token`, `refresh_token`) in the adapter stderr tail shown on the crash card and in npm's install output. It is a best-effort pattern match. Protocol logs enabled with `agent.debugLogs` are written by the adapters themselves and are not masked by Xora.

WebView:

- Capabilities (`src-tauri/capabilities/default.json`) grant the main window `core:default`, specific window permissions (dragging, minimize, maximize, close, destroy, effects, user attention), webview zoom, `opener:default` and `dialog:default`. Custom commands are not gated by capabilities: every registered command is callable from the window.
- The asset protocol is scoped to `$APPDATA/wallpapers/*`.
- The UI makes one network request of its own: while Settings > General > Check for updates is on, `features/updates` sends an unauthenticated `GET` to `api.github.com/repos/Mavrom/xora-code/releases/latest` from the WebView's `fetch`, at most once a day (no cookies, no referrer; failures are silent). The release link it shows is opened only if it is an `https://github.com/Mavrom/xora-code/` URL. Turned off, no request is made.
- There is no Content Security Policy (`"csp": null` in `tauri.conf.json`). Agent Markdown is sanitized with DOMPurify (`chat/renderMarkdown.ts`) before it is rendered.

Not sandboxed, stated plainly: the adapters and everything they start, ACP terminal commands, the integrated terminal, and the UI's file commands.

Edit and retry rewinds the conversation only: files on disk stay as the later turns left them. The cut point of a fork relies on an adapter extension (`_meta.jetbrains.air.fork`) that only the checked adapter versions get; any other agent, or a refused fork, gets a new chat seeded with the transcript as text, so the agent sees a summary, not its own history.

## Extending

What exists to build on:

- **Another ACP agent:** add an `AgentSpec` to `SPECS` in `agents/registry.rs`, an `AgentId` variant in `events.rs` and `types.ts` (and in `settings::AgentId` and `accounts::Provider`), its environment in `launch_spec`, its modes in `MODE_BY_POLICY`, and its entry in the UI's `AGENT_IDS` / `AGENT_NAMES`. The transport, bridges, permissions and review code do not depend on which agent it is.
- **Client-side ACP methods:** the `ClientHandlers` trait in `agents/acp.rs` is the boundary between the protocol and the bridges; `handle_request` in `manager.rs` routes methods to it.
- **A new event for the UI:** add an `AgentEvent` variant, mirror it in `src/features/agents/types.ts` and handle it in `reduceEvents`.
- **A new setting:** add the field with its default to `settings/mod.rs` and `features/settings/types.ts`; invalid stored values fall back to the default on their own.

There is no backend abstraction other than ACP: an agent is an ACP adapter process.

## Folder map

Top level and the parts a newcomer needs (`node_modules`, `target`, `dist` and `src-tauri/gen` excluded).

```
.
├── .github/workflows/
│   ├── ci.yml                 npm run check, build, cargo fmt/clippy/test on Windows and macOS
│   └── release.yml            Universal macOS .dmg and Windows .exe/.msi to a draft release
├── assets/brand/              Source logo (SVG) and icon render script
├── docs/
│   ├── architecture.md        This file
│   └── assets/                README screenshots
├── scripts/
│   ├── tauri.mjs              `npm run tauri` entry; MSVC / LLVM-MinGW switch on Windows
│   └── gen-monaco-slim.mjs    Generates the slim Monaco entry
├── index.html, vite.config.ts Vite entry and config (`@` alias, slim Monaco, test setup)
├── src/                       Frontend (WebView)
│   ├── main.tsx               React root, global styles
│   ├── app/                   App shell: App, Layout, Sidebar, MainBar, FilesDrawer, close guards
│   ├── features/
│   │   ├── agents/            Agent store, reducer, event types, IPC, fixture mode
│   │   ├── backdrop/          New-chat wallpaper and conversation scrim
│   │   ├── chat/              Conversation UI, composer, tool cards, changes bar
│   │   ├── commands/          Command palette, registry, fuzzy matching
│   │   ├── editor/            Monaco, tabs, diff tabs, save, disk sync
│   │   │   └── monaco/        Workers, xora-onyx theme, generated slim entry
│   │   ├── files/             Explorer tree, quick open, file index
│   │   ├── git/               Changes panel, worktrees
│   │   ├── inbox/             Notes
│   │   ├── keymap/            App shortcuts: actions, bindings, capture, conflicts
│   │   ├── search/            Find in files
│   │   ├── settings/          Settings view, store, controls, sections
│   │   ├── terminal/          Terminal dock and xterm sessions
│   │   ├── updates/           Daily newer-release check and its notice
│   │   └── workspace/         Open folder, recents, restore, file watcher
│   ├── shared/
│   │   ├── i18n/              t(), msg(), Turkish catalog
│   │   ├── lib/               ipc.ts and framework-free helpers
│   │   └── ui/                UI primitives
│   └── styles/globals.css     Design tokens (@theme) and base styles
└── src-tauri/                 Rust core
    ├── Cargo.toml
    ├── tauri.conf.json        Window (frameless, transparent), security, bundle
    ├── tauri.macos.conf.json  macOS window: native traffic lights, overlay title bar
    ├── capabilities/default.json  Permissions granted to the main window
    ├── icons/                 App icons
    └── src/
        ├── main.rs            Binary entry, calls run()
        ├── lib.rs             Builder: plugins, managed state, invoke_handler, exit hook
        ├── error.rs           AppError / AppResult
        ├── system.rs          Host name, macOS login-shell PATH
        ├── accounts/          Agent CLI detection and sign-in
        ├── agents/            ACP client: manager, transport, bridges, sandbox, review
        ├── fs/                Files, index, search, watcher
        ├── git/               Status, changes, show, worktrees, deadline
        ├── notes/             Inbox file
        ├── settings/          Settings file, wallpaper
        └── terminal/          PTY sessions, shell choice
```

## Interface language

Every interface string goes through `t()` from `src/shared/i18n`, with the English text as the message id: `t("New chat")`, `t("Continue with {name}", { name })`. `src/shared/i18n/tr.ts` maps each id to Turkish; a missing entry falls back to English. A string kept as data (command lists, option labels) is marked with `msg()` where it is defined and translated with `t()` where it is shown; a plain `t()` in a module-level list also works, because a language change reloads the window.

The language comes from Settings > General > Language (`auto` follows the system). It is cached in `localStorage`, so the first render already uses it, and changing it reloads the window (`src/app/language.ts`). `src/shared/i18n/i18n.test.ts` fails when a message has no Turkish entry, an entry is no longer used, or the placeholders differ: add the Turkish line next to any new `t()` or `msg()` call.

Rust error messages are English; the UI shows its own translated text for the coded ones.

## Platforms and builds

- **Windows toolchain:** `npm run tauri` runs `scripts/tauri.mjs`. Without the MSVC linker it switches to LLVM-MinGW (from `%LOCALAPPDATA%\xora-toolchain` or `XORA_LLVM_MINGW`) for `dev`, with its own target dir; it refuses to build installers that way, because the result would need DLLs the installer does not ship. `npm run dev:mingw` forces it.
- **macOS window:** `tauri.macos.conf.json` keeps native decorations with an overlay title bar and positioned traffic lights; elsewhere the window is frameless with `WindowControls`. `tauri.conf.json` enables `macOSPrivateApi` for the transparent window.
- **macOS environment:** `adopt_login_shell_path` fixes the bare launchd `PATH`; `accounts` also looks in `/usr/local/bin` and `/opt/homebrew/bin`.
- **Process trees:** agent adapters, ACP terminal commands and timed git commands are put in a kill-on-close Job Object on Windows; elsewhere they lead their own process group, which is killed on terminate and on drop (if the app itself dies, the group survives). They start with no console window (`hide_console`); `git` and `--version` probes also run without one.
- **Shells:** see the terminal module; `term_spawn` falls back to the home folder when the requested folder does not exist.
- **CI** (`.github/workflows/ci.yml`), on pushes to `main` and on pull requests, on `windows-latest` and `macos-latest`: `npm run check`, `npm run build`, `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`.
- **Release** (`.github/workflows/release.yml`), on a `v*` tag or by hand: a universal macOS `.dmg` (ad-hoc signed, or signed and notarized when the Apple secrets are set) and the Windows NSIS `.exe` and `.msi` built with MSVC, checked for unwanted DLL imports, uploaded to a draft release.
