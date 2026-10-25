# Xora Code

**English** · [Türkçe](README.tr.md)

An open-source, agent-first code editor. Bring your own Claude, ChatGPT or Gemini subscription.

![Xora Code: file explorer, chat surface and editor side by side](docs/assets/screenshot.png)

Xora Code puts an AI agent conversation at the center of the window, with a file explorer on one side and a code editor on the other. Agents will run through the official CLIs you already use (Claude Code, Codex, Gemini CLI), signed in with your own subscription. Xora Code has no AI billing of its own and asks for no API keys.

> **Status:** Phase 1 (editor foundation) is complete. The agent connection arrives in Phase 2; until then the chat panel is a placeholder. Windows is the first target; the code is written to stay cross-platform. The UI copy is currently in Turkish.

## Features

What works today:

| Area            | What you get                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Window          | Onyx / AMOLED-black interface with a custom frameless title bar (drag, minimize, maximize, close).                                                                                                |
| Layout          | Resizable three-panel layout: sidebar, chat, editor. Panel sizes are remembered between sessions; the editor panel can be collapsed.                                                              |
| Activity bar    | Switches the sidebar between **Explorer** and **Inbox**. The last view is remembered; the Inbox icon shows a badge with the number of open notes.                                                 |
| Explorer        | Folder tree with lazy loading (directories are read when expanded), folders first, `.git` hidden. Full keyboard navigation: roving tabindex, arrow keys, Home/End, type-ahead.                    |
| Editor          | Monaco, bundled locally (works offline) and lazy-loaded only when the first file opens. Custom `xora-onyx` theme, tabs, unsaved-change (dirty) tracking, save and close shortcuts.                |
| Inbox           | Quick-capture notes: add, edit inline, pin, mark done, delete with undo. Saved to disk atomically by the Rust `notes` module, with debounced writes, automatic retry, and a final flush on close. |
| Command palette | `Ctrl+K` or `Ctrl+Shift+P`. Fuzzy search that is Turkish-aware (`klasor ac` finds `Klasör aç`), grouped commands, shortcut hints.                                                                 |
| Chat            | Conversation surface and composer, ready for the Phase 2 agent connection.                                                                                                                        |

## Keyboard shortcuts

On macOS, `Cmd` also works in place of `Ctrl` for the palette, save, close tab and undo.

### Global

| Shortcut                  | Action                                     |
| ------------------------- | ------------------------------------------ |
| `Ctrl+K` / `Ctrl+Shift+P` | Toggle the command palette                 |
| `Ctrl+Shift+E`            | Show the Explorer                          |
| `Ctrl+Shift+N`            | Show the Inbox and focus the note composer |
| `Ctrl+S`                  | Save the active file                       |
| `Ctrl+W`                  | Close the active tab                       |

### Command palette

| Shortcut  | Action                |
| --------- | --------------------- |
| `↑` / `↓` | Move the selection    |
| `Enter`   | Run the selected item |
| `Esc`     | Close the palette     |

### Explorer

| Shortcut          | Action                                               |
| ----------------- | ---------------------------------------------------- |
| `↑` / `↓`         | Previous / next item                                 |
| `→`               | Expand a folder, or move into its first child        |
| `←`               | Collapse a folder, or move to the parent             |
| `Home` / `End`    | First / last item                                    |
| `Enter` / `Space` | Open a file, or expand / collapse a folder           |
| Letters           | Type-ahead: jump to the next item starting with them |

### Editor tabs

| Shortcut       | Action                |
| -------------- | --------------------- |
| `←` / `→`      | Previous / next tab   |
| `Home` / `End` | First / last tab      |
| `Delete`       | Close the focused tab |

### Inbox

| Shortcut        | Where              | Action               |
| --------------- | ------------------ | -------------------- |
| `Enter`         | Composer           | Add the note         |
| `Shift+Enter`   | Composer / editing | New line             |
| `Esc`           | Composer           | Leave the composer   |
| `↑` / `↓`       | Note list          | Previous / next note |
| `Enter`         | Focused note       | Edit inline          |
| `P`             | Focused note       | Pin / unpin          |
| `E`             | Focused note       | Mark done / reopen   |
| `Delete`        | Focused note       | Delete               |
| `Ctrl+Z`        | Inbox panel        | Undo the last delete |
| `Enter` / `Esc` | Inline edit        | Save / cancel        |

## Roadmap

The core idea is **bring your own subscription**: Xora Code talks to the official agent CLIs over the [Agent Client Protocol (ACP)](https://agentclientprotocol.com/), and you sign in through each CLI's own login flow. API-key support is out of scope for now.

| Phase | Scope                                                                                                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | **Done.** Editor foundation: layout, theme, Explorer, Monaco, Inbox, command palette.                                                                                                                              |
| 2     | ACP agent connection for Claude Code, Codex and Gemini CLI using your own subscriptions. Streaming chat, permission prompts, diff review of agent edits, file watcher, workspace sandbox for file-system commands. |
| 3     | Accounts screen: per-provider status, sign-in, and install guidance when a CLI is missing.                                                                                                                         |
| 4     | Integrated terminal, per-project session history, settings, Windows installer.                                                                                                                                     |

## Tech stack

| Layer   | Choice                                                         |
| ------- | -------------------------------------------------------------- |
| Shell   | [Tauri 2](https://v2.tauri.app/) (Rust core, system WebView)   |
| UI      | React 19, TypeScript, Vite                                     |
| Styling | Tailwind CSS v4 with design tokens in `src/styles/globals.css` |
| State   | Zustand                                                        |
| Editor  | Monaco (`monaco-editor` + `@monaco-editor/react`)              |
| Layout  | `react-resizable-panels`                                       |
| Icons   | Lucide                                                         |
| Testing | Vitest (frontend), `cargo test` (Rust)                         |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 24 or newer
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- Tauri system prerequisites for your OS (on Windows: Microsoft C++ Build Tools and WebView2): see [v2.tauri.app/start/prerequisites](https://v2.tauri.app/start/prerequisites/)

### Run

```bash
npm install
npm run tauri dev
```

The first run compiles the Rust core and takes a few minutes; later runs are incremental.

### Scripts

| Command               | What it does                                      |
| --------------------- | ------------------------------------------------- |
| `npm run tauri dev`   | Run the desktop app with hot reload               |
| `npm run tauri build` | Build a release bundle                            |
| `npm run check`       | Typecheck, lint, format check and tests (CI gate) |
| `npm test`            | Run the Vitest suite                              |
| `npm run lint`        | Run ESLint                                        |
| `npm run format`      | Format the repository with Prettier               |
| `npm run typecheck`   | Run the TypeScript compiler without emitting      |

Rust checks run against `src-tauri/Cargo.toml`; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Project structure

```
src/
  app/          App shell: layout, title bar, activity bar, UI store
  features/     One folder per feature (chat, commands, editor, files, inbox, workspace)
  shared/       Shared code: lib/ (typed IPC, path helpers), ui/ (primitives)
  styles/       globals.css: design tokens and base styles
src-tauri/
  src/          Rust core: error.rs, fs/, notes/ (each module: mod.rs + commands.rs)
docs/           Architecture notes and the design spec
```

Read [docs/architecture.md](docs/architecture.md) for the process model, the full folder map and data flows.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for setup, quality gates and conventions.

## License

[MIT](LICENSE) © 2026 Xora Code contributors
