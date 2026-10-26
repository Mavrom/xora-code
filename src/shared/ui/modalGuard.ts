// While an in-app modal is open, app shortcuts (Ctrl+W, Ctrl+K, Ctrl+Shift+E, ...) must not
// act on the UI behind it. The window capture listener below is installed when this module
// loads, which happens before any feature registers its own shortcut listener (they do so in
// effects or in App's module body after its imports), so it runs first and can stop them.
// Plain keys (Tab, Enter, Esc, letters) still reach the dialog.

let openModals = 0;

/** True while any in-app modal dialog is open. */
export const isModalOpen = () => openModals > 0;

const TEXT_EDIT_KEYS = new Set(["c", "v", "x", "a", "z", "y"]);

type ModifierEvent = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">;

/** Whether a key press must be swallowed while a modal is open. */
export function blocksWhileModal(e: ModifierEvent, inTextField: boolean): boolean {
  if (!(e.ctrlKey || e.metaKey || e.altKey)) return false;
  // Clipboard and undo keep working inside the dialog's own fields.
  return !(inTextField && !e.altKey && TEXT_EDIT_KEYS.has(e.key.toLowerCase()));
}

if (typeof window !== "undefined") {
  window.addEventListener(
    "keydown",
    (e) => {
      if (openModals === 0) return;
      const inField = e.target instanceof HTMLElement && !!e.target.closest("input, textarea");
      if (!blocksWhileModal(e, inField)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true,
  );
}

/**
 * Marks a modal as open: the app root becomes inert (no clicks, focus or AX tree behind the
 * dialog) and shortcuts are swallowed. Returns the function that closes it again.
 */
export function enterModal(): () => void {
  openModals += 1;
  const app = typeof document === "undefined" ? null : document.getElementById("root");
  app?.setAttribute("inert", "");
  let left = false;
  return () => {
    if (left) return;
    left = true;
    openModals -= 1;
    if (openModals === 0) app?.removeAttribute("inert");
  };
}
