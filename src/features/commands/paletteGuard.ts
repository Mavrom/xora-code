// While the command palette is open, the app's global shortcuts must not fire behind it
// (closing a tab, saving, switching the sidebar). Handlers this feature owns check
// `isPaletteOpen()`; for everyone else a window capture listener swallows the keys.

let open = false;

export const isPaletteOpen = () => open;

export function setPaletteOpen(value: boolean) {
  open = value;
}

type ShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
>;

/**
 * App-level shortcuts that act outside the palette: Ctrl+W, Ctrl+S, Ctrl+Shift+N/E
 * (Cmd on macOS). Physical codes for the shifted ones so keyboard layouts do not matter.
 */
export function isGlobalShortcut(e: ShortcutEvent) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
  if (e.shiftKey) return e.code === "KeyN" || e.code === "KeyE" || e.code === "KeyH";
  const key = e.key.toLowerCase();
  return key === "w" || key === "s";
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
