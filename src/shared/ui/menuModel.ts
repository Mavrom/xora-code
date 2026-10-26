// Right-click menu plumbing: the item model, placement and the guard that turns off
// the WebView's own page menu.
import type { LucideIcon } from "lucide-react";

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  /** Red, for destructive actions. */
  danger?: boolean;
  onSelect: () => void;
}

/** A hairline between groups of items. */
export const SEPARATOR = "separator" as const;

export type MenuEntry = MenuItem | typeof SEPARATOR;

/** Keeps a `width` x `height` box opened at (x, y) inside the viewport, 8 px from its edges. */
export function placeMenu(
  x: number,
  y: number,
  width: number,
  height: number,
  viewW: number,
  viewH: number,
) {
  const margin = 8;
  const left = x + width + margin > viewW ? Math.max(margin, x - width) : x;
  const top = y + height + margin > viewH ? Math.max(margin, y - height) : y;
  return { left, top };
}

/**
 * True when the browser's own menu is still useful at `target`: text fields (cut, copy,
 * paste, spelling) and selected text (copy). Everywhere else Xora shows its own or none.
 */
export function wantsNativeMenu(target: EventTarget | null, selection: string): boolean {
  if (selection.trim().length > 0) return true;
  if (!(target instanceof Element)) return false;
  return target.closest('input, textarea, [contenteditable=""], [contenteditable="true"]') !== null;
}

/** Turns off the WebView's page menu (Geri, Yenile, Yazdır…) outside text fields. */
export function installContextMenuGuard() {
  const onContextMenu = (e: MouseEvent) => {
    if (e.defaultPrevented) return;
    if (!wantsNativeMenu(e.target, window.getSelection()?.toString() ?? "")) e.preventDefault();
  };
  window.addEventListener("contextmenu", onContextMenu);
  return () => window.removeEventListener("contextmenu", onContextMenu);
}
