# Contributing to Xora Code

Thanks for your interest. This guide covers setup, the checks every change must pass, and the conventions that keep the codebase consistent. For how the pieces fit together, read [docs/architecture.md](docs/architecture.md).

## Prerequisites

| Tool                | Version / notes                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| Node.js             | 24 or newer                                                                                               |
| Rust                | Stable toolchain with `rustfmt` and `clippy` (`rustup component add rustfmt clippy`)                      |
| Tauri prerequisites | Per OS; on Windows: Microsoft C++ Build Tools and WebView2. See https://v2.tauri.app/start/prerequisites/ |

## Setup

```bash
git clone <your-fork-url> xora-code
cd xora-code
npm install
npm run tauri dev
```

`npm run dev` starts only the Vite frontend in a browser. Anything that calls Rust (opening folders, reading files, the Inbox) needs `npm run tauri dev`.

## Quality gates

CI runs these on every pull request. Run them locally before you push:

```bash
npm run check                                                        # typecheck, lint, format check, tests
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

`npm run format` fixes formatting. Clippy warnings are errors.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`. An optional scope helps: `feat(inbox): pin notes`.
- Keep commits small and focused; one logical change per commit.
- Keep pull requests to one topic. Describe what changed, why, and how you tested it; add a screenshot for visible UI changes.
- New logic comes with tests. Pure functions (tree navigation, fuzzy matching, sorting) are the easiest place to start.

## Folder conventions

### Frontend (`src/`)

| Location                 | What goes there                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `src/app/`               | App shell: `Layout`, title bar, activity bar, window controls, cross-feature UI state (`uiStore`).                |
| `src/features/<name>/`   | One folder per feature. Co-locate its components, Zustand store, pure logic and tests (`foo.ts` + `foo.test.ts`). |
| `src/shared/lib/`        | Framework-free helpers used by several features, including the typed IPC layer `ipc.ts`.                          |
| `src/shared/ui/`         | Reusable UI primitives (`Button`, `IconButton`, `Kbd`, `EmptyState`, `PanelHeader`, `cn`).                        |
| `src/styles/globals.css` | The only place design tokens are defined.                                                                         |

Rules of thumb:

- Keep logic that can be pure out of components and test it directly.
- A feature may import from `shared/` and, sparingly, from another feature's public pieces. `shared/` never imports from `features/` or `app/`.
- Use the `@/` alias for imports across folders.
- Never call `invoke` directly; add a typed wrapper to `src/shared/lib/ipc.ts`.

### Rust (`src-tauri/src/`)

- Each domain gets its own module folder with `mod.rs` (domain logic and unit tests, no Tauri types where avoidable) and `commands.rs` (thin `#[tauri::command]` wrappers).
- Register new commands in `lib.rs` and add the matching wrapper to `src/shared/lib/ipc.ts`. Command names are `snake_case` with a domain prefix: `fs_read_file`, `notes_save`.
- Commands return `AppResult<T>`. Errors go through `AppError` in `error.rs`, which serializes to a plain message string for the frontend. Domain error types (like `NotesError`) convert into `AppError` with `#[from]`.
- Commands are `async`; blocking disk work belongs on the blocking pool, never on the UI thread.
- New window or plugin permissions go into `src-tauri/capabilities/default.json`, scoped as narrowly as possible.

## Design rules

The interface is onyx / AMOLED black with a monochrome accent. Keep it calm and dense.

- **Tokens only.** Use the Tailwind utilities generated from `src/styles/globals.css` (`bg-surface`, `text-fg-muted`, `border-border`, `rounded-md`, `text-ui` and so on). No raw hex values or ad-hoc colors in components. If a value is missing, add a token first.
- **Motion is CSS-only.** Transitions and keyframes in CSS, using the duration and easing tokens. No animation libraries.
- **Respect reduced motion.** Every animation must be disabled or reduced under `prefers-reduced-motion: reduce`.
- **Accessibility basics:**
  - Everything is reachable and operable by keyboard, with a visible focus state.
  - Use semantic elements and correct ARIA roles; composite widgets (trees, tab lists) use roving tabindex.
  - Icon-only buttons have an accessible label.
  - Text meets WCAG AA contrast; `fg-subtle` is for icons and meta text only.
  - Advertise shortcuts with `aria-keyshortcuts` and show them with `<Kbd>`.
- **Shortcuts must not collide** with WebView2 (`Ctrl+Shift+I` / `J` open devtools) or with Monaco's own bindings. Global shortcuts listen in the capture phase.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
