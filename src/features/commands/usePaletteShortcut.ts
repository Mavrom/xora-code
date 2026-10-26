import { useEffect, useRef } from "react";

/** True for Ctrl+K and Ctrl+Shift+P (Cmd on macOS). */
export function isPaletteShortcut(
  e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">,
) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
  const key = e.key.toLowerCase();
  return (key === "k" && !e.shiftKey) || (key === "p" && e.shiftKey);
}

/** True for Ctrl+P (Cmd on macOS) without Shift: quick open. WebView2 would print. */
export function isQuickOpenShortcut(
  e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">,
) {
  return (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "p";
}

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
