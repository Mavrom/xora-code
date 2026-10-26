# Xora Code

**English** · [Türkçe](README.tr.md)

An open-source, agent-first code editor. Bring your own Claude, ChatGPT or Gemini subscription.

![Xora Code: file explorer, chat surface and editor side by side](docs/assets/screenshot.png)

Xora Code puts an AI agent conversation at the center of the window. Your conversations sit on the left, the file explorer and the editor open when you need them, and your own wallpaper can glow through glass panels. Agents run through the official adapters for the CLIs you already use (Claude Code, Codex, Gemini CLI), signed in with your own subscription. Xora Code has no AI billing of its own and asks for no API keys.

> **Status:** Phases 1 and 2 are in: editor foundation, working agent chat over ACP, settings and accounts, integrated terminal. Verified end to end with Claude Code on Windows. Gemini CLI connects and reaches sign-in, but Google has retired personal Google sign-in for Gemini CLI (it now points to Antigravity), so a Gemini subscription cannot be used this way today. Codex uses the same path and still needs a run with a ChatGPT account. Windows is the first target; the code is written to stay cross-platform. The UI copy is in Turkish.

## Features

What works today:

| Area            | What you get                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent chat      | Claude Code, Codex and Gemini CLI over the [Agent Client Protocol](https://agentclientprotocol.com/). Streaming answers, thinking blocks, tool-call cards, plans, slash commands, stop.           |
| Model and mode  | Model, mode and effort pickers filled from what each agent reports (Gemini has no effort setting over ACP, so it is hidden there).                                                                |
| Permissions     | Agent edits and commands ask first, with a diff preview. A changes bar lists the files a turn touched; accept or revert each one.                                                                 |
| Sandbox         | Agent file and terminal access is limited to the open folder (symlinks, `..` and junctions are resolved before the check).                                                                        |
| Sessions        | Conversations grouped by project in the sidebar, reopened with the agent's own history (`session/load` / `resume`), plus a local index for agents without one.                                    |
| Settings        | Accounts (detects each CLI, sign-in state, sign in / install), agent defaults, editor, general, shortcuts, about. `Ctrl+,`.                                                                       |
| Look            | Onyx / AMOLED black, custom frameless title bar. Optional wallpaper with adjustable glass, blur and dim.                                                                                          |
| Terminal        | Integrated PowerShell / shell tabs under the chat and editor (``Ctrl+` ``).                                                                                                                       |
| Layout          | Chat-first: the editor stays closed until a file opens. Resizable panels, sizes remembered between sessions.                                                                                      |
| Activity bar    | Switches the sidebar between **Conversations**, **Explorer** and **Inbox**; settings sit at the bottom. The Inbox icon shows a badge with the number of open notes.                               |
| Explorer        | Virtualised folder tree with live refresh from a file watcher, recent folders, last folder reopened on start. Full keyboard navigation: roving tabindex, arrow keys, Home/End, type-ahead.        |
| Editor          | Monaco, bundled locally (works offline) and lazy-loaded only when the first file opens. Custom `xora-onyx` theme, tabs, unsaved-change (dirty) tracking, save and close shortcuts.                |
| Inbox           | Quick-capture notes: add, edit inline, pin, mark done, delete with undo. Saved to disk atomically by the Rust `notes` module, with debounced writes, automatic retry, and a final flush on close. |
| Command palette | `Ctrl+K` or `Ctrl+Shift+P`. Fuzzy search that is Turkish-aware (`klasor ac` finds `Klasör aç`), grouped commands, shortcut hints.                                                                 |

## Keyboard shortcuts

On macOS, `Cmd` also works in place of `Ctrl` for the palette, save, close tab and undo.

### Global

| Shortcut                  | Action                                     |
| ------------------------- | ------------------------------------------ |
| `Ctrl+K` / `Ctrl+Shift+P` | Toggle the command palette                 |
| `Ctrl+Shift+H`            | Show the conversations                     |
| `Ctrl+Shift+E`            | Show the Explorer                          |
| `Ctrl+Shift+N`            | Show the Inbox and focus the note composer |
| `Ctrl+S`                  | Save the active file                       |
| `Ctrl+W`                  | Close the active tab                       |
| `Ctrl+,`                  | Open or close the settings                 |
| ``Ctrl+` ``               | Toggle the terminal                        |

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

| Phase | Scope                                                                                                                                   |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **Done.** Editor foundation: layout, theme, Explorer, Monaco, Inbox, command palette.                                                   |
| 2     | **Done.** ACP agent connection with your own subscriptions: streaming chat, permissions, diff review and revert, sandbox, file watcher. |
| 3     | **Done.** Settings and accounts, wallpaper and glass, integrated terminal, conversation history.                                        |
| Next  | Full Codex and Gemini runs, a Windows installer, optional managed Node.js for the Claude adapter, update notices for pinned adapters.   |

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

- [Node.js](https://nodejs.org/) 24 or newer (the agent adapters need Node.js 22+ at runtime; Xora installs the pinned adapter versions itself on first use)
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
  features/     One folder per feature (agents, chat, commands, editor, files, inbox, settings, terminal, workspace)
  shared/       Shared code: lib/ (typed IPC, path helpers), ui/ (primitives)
  styles/       globals.css: design tokens and base styles
src-tauri/
  src/          Rust core: agents/ (ACP), accounts/, fs/, notes/, settings/, terminal/ (each module: mod.rs + commands.rs)
docs/           Architecture notes and the design spec
```

Read [docs/architecture.md](docs/architecture.md) for the process model, the full folder map and data flows.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for setup, quality gates and conventions.

## License

[MIT](LICENSE) © 2026 Xora Code contributors
