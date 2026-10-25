/** localStorage key for the composer's unsent text. */
export const DRAFT_KEY = "xora.inbox.draft";

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** `localStorage` when reachable; access itself can throw (blocked site data). */
function defaultStorage(): DraftStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** The saved draft, or "" when there is none or storage is unavailable. */
export function readDraft(storage: DraftStorage | null = defaultStorage()): string {
  try {
    return storage?.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Remembers `text` so it survives a restart; whitespace-only text clears it.
 * Failures (quota, private mode) are ignored: the draft simply is not kept.
 */
export function writeDraft(text: string, storage: DraftStorage | null = defaultStorage()): void {
  try {
    if (text.trim()) storage?.setItem(DRAFT_KEY, text);
    else storage?.removeItem(DRAFT_KEY);
  } catch {
    // Best effort only.
  }
}
