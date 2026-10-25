type KeyLike = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">;

const isMod = (e: KeyLike, key: string) =>
  (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === key;

/** Ctrl+W / Cmd+W. */
export const isCloseTabShortcut = (e: KeyLike) => isMod(e, "w");

/** Ctrl+S / Cmd+S (Shift is left free for a future "save as"). */
export const isSaveShortcut = (e: KeyLike) => isMod(e, "s");

/** Id of the focusable wrapper around the editor's "no open file" state. */
export const EDITOR_EMPTY_ID = "xora-editor-empty";

/** Rendered and laid out (not `hidden`, not inside a collapsed panel). */
export const isShown = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLElement && el.getClientRects().length > 0 && el.offsetWidth > 0;
