type KeyLike = Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">;

/**
 * Ctrl+` toggles the terminal (Ctrl on macOS too, like VS Code). Matched on the physical
 * key so it works on layouts where that key types something else (Turkish Q: `"`).
 */
export const isToggleTerminalShortcut = (e: KeyLike) =>
  e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.code === "Backquote";

/** Ctrl+Shift+` opens a new terminal tab. */
export const isNewTerminalShortcut = (e: KeyLike) =>
  e.ctrlKey && !e.metaKey && !e.altKey && e.shiftKey && e.code === "Backquote";

const isMac = () => typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

/** What a key press inside the terminal means for clipboard handling. */
export type ClipboardAction = "copy" | "paste" | null;

/**
 * Clipboard keys inside the terminal. Ctrl+C copies only while text is selected (else it
 * stays the interrupt signal); Ctrl+V and Ctrl+Shift+C/V always use the clipboard.
 * On macOS the system's Cmd+C/V already work and Ctrl keeps its terminal meaning.
 */
export function clipboardAction(
  e: KeyLike & { type: string },
  hasSelection: boolean,
  mac = isMac(),
): ClipboardAction {
  if (e.type !== "keydown" || mac || !e.ctrlKey || e.altKey || e.metaKey) return null;
  const key = e.key.toLowerCase();
  if (key === "c") return e.shiftKey || hasSelection ? "copy" : null;
  if (key === "v") return "paste";
  return null;
}
