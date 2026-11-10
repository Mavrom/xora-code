import { useEffect, useRef } from "react";
import type { KeyEventLike } from "@/features/keymap/binding";
import { matchesAction } from "@/features/keymap/keymap";

/** The command palette's keys (by default Ctrl+K and Ctrl+Shift+P, Cmd on macOS). */
export const isPaletteShortcut = (e: KeyEventLike) => matchesAction(e, "palette.open");

/** Quick open (by default Ctrl+P, Cmd on macOS). WebView2 would print. */
export const isQuickOpenShortcut = (e: KeyEventLike) => matchesAction(e, "workspace.quickOpen");

/**
 * Calls `onToggle` for the palette shortcuts anywhere in the app. Capture phase plus
 * stopPropagation so Monaco's own Ctrl+K chords and command palette never see them.
 */
export function usePaletteShortcut(onToggle: () => void) {
  const handler = useRef(onToggle);
  useEffect(() => {
    handler.current = onToggle;
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || !isPaletteShortcut(e)) return;
      e.preventDefault();
      e.stopPropagation();
      handler.current();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
}
