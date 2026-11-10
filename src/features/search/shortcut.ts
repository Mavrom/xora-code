import type { SearchOptions } from "./ipc";

type KeyLike = Pick<KeyboardEvent, "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">;

/**
 * Ctrl+Shift+F (Cmd+Shift+F on macOS): find in files. The physical key, like the app's other
 * Ctrl+Shift letters, so keyboard layouts do not matter.
 */
export const isFindInFilesShortcut = (e: KeyLike) =>
  (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.code === "KeyF";

/** Alt+C / Alt+W / Alt+R flip the search options, as in VS Code (physical keys). */
const TOGGLE_CODES: Record<string, keyof SearchOptions> = {
  KeyC: "caseSensitive",
  KeyW: "wholeWord",
  KeyR: "regex",
};

/** The option an Alt+letter press flips, if any. AltGr (Ctrl+Alt on Windows) does not count. */
export function toggleFor(e: Pick<KeyLike, "code" | "altKey" | "ctrlKey" | "metaKey">) {
  if (!e.altKey || e.ctrlKey || e.metaKey) return undefined;
  return TOGGLE_CODES[e.code];
}
