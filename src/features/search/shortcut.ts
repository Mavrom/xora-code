import type { KeyEventLike } from "@/features/keymap/binding";
import { matchesAction } from "@/features/keymap/keymap";
import type { SearchOptions } from "./ipc";

type KeyLike = Pick<KeyboardEvent, "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">;

/** Find in files (by default Ctrl+Shift+F, Cmd+Shift+F on macOS). */
export const isFindInFilesShortcut = (e: KeyEventLike) => matchesAction(e, "search.findInFiles");

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
