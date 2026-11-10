// While the command palette is open, the app's global shortcuts must not fire behind it
// (closing a tab, saving, switching the sidebar). Handlers this feature owns check
// `isPaletteOpen()`; for everyone else a window capture listener swallows the keys.

import type { ActionId } from "@/features/keymap/actions";
import type { KeyEventLike } from "@/features/keymap/binding";
import { resolve } from "@/features/keymap/keymap";

let open = false;

export const isPaletteOpen = () => open;

export function setPaletteOpen(value: boolean) {
  open = value;
}

/**
 * App-level actions that act outside the palette and whose handlers do not ask
 * `isPaletteOpen()` themselves: close tab, save and the sidebar views.
 */
const GUARDED = new Set<ActionId>([
  "editor.closeTab",
  "editor.save",
  "view.explorer",
  "view.sessions",
  "view.inbox",
  "view.changes",
]);

/** Whether `e` is one of the actions this guard swallows while the palette is open. */
export function isGlobalShortcut(e: KeyEventLike) {
  const action = resolve(e);
  return action !== null && GUARDED.has(action);
}

let installed = false;

/**
 * Installs the swallowing listener once. Call it at module load, before any component
 * mounts: listeners on the same target run in registration order, and this one has to run
 * ahead of the other features' capture-phase window listeners to stop them.
 */
export function installPaletteGuard(target: Pick<Window, "addEventListener"> = window) {
  if (installed) return;
  installed = true;
  target.addEventListener(
    "keydown",
    (e) => {
      if (!open || !isGlobalShortcut(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true,
  );
}
