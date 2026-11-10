type KeyLike = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">;

const isMod = (e: KeyLike, key: string) =>
  (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === key;

/** Ctrl+W / Cmd+W. */
export const isCloseTabShortcut = (e: KeyLike) => isMod(e, "w");

/** Ctrl+S / Cmd+S (Shift is left free for a future "save as"). */
export const isSaveShortcut = (e: KeyLike) => isMod(e, "s");

/**
 * Next / previous change in a diff tab: Alt+F5 / Shift+Alt+F5, as in VS Code. (F7 is taken:
 * Monaco opens its accessible diff viewer with it.)
 */
export const DIFF_NEXT_SHORTCUT = "alt+f5";
export const DIFF_PREVIOUS_SHORTCUT = "shift+alt+f5";

/** Which way a diff navigation key goes, or `null` for any other key. */
export function diffNavigation(e: KeyLike): "next" | "previous" | null {
  if (e.key !== "F5" || !e.altKey || e.ctrlKey || e.metaKey) return null;
  return e.shiftKey ? "previous" : "next";
}

/** Id of the focusable wrapper around the editor's "no open file" state. */
export const EDITOR_EMPTY_ID = "xora-editor-empty";

/** Horizontal extent of one tab inside the scrolling strip, in px. */
export interface TabSpan {
  start: number;
  end: number;
}

/**
 * New `scrollLeft` for the tab strip so tab `index` is fully visible clear of the `fade`
 * masks on both sides, or `null` when it already is. When scrolling right brings the
 * active tab in, a tab left cut in half at the left edge is scrolled to a faded sliver
 * instead, so no label is ever shown half under the mask.
 */
export function revealTabScroll(
  tabs: readonly TabSpan[],
  index: number,
  scrollLeft: number,
  width: number,
  fade: number,
): number | null {
  const tab = tabs[index];
  if (!tab) return null;
  // At the very start there is no fade, so the first tab needs no margin.
  const startMargin = index === 0 ? 0 : fade;
  if (tab.start - startMargin < scrollLeft) return Math.max(0, tab.start - startMargin);
  if (tab.end + fade <= scrollLeft + width) return null;
  let next = tab.end + fade - width;
  const edge = next + fade;
  const cut = tabs.find((t, i) => i < index && t.start < edge && t.end > edge);
  if (cut) next = Math.min(cut.end - fade, tab.start - fade);
  return Math.max(0, next);
}

/** Rendered and laid out (not `hidden`, not inside a collapsed panel). */
export const isShown = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLElement && el.getClientRects().length > 0 && el.offsetWidth > 0;
