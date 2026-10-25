import { useEffect } from "react";
import { registerCloseGuard } from "@/app/closeGuards";
import { flushNow } from "./store";

/** Commits an open inline edit (its blur handler saves) and writes pending notes. */
function flushBeforeClose() {
  (document.activeElement as HTMLElement | null)?.blur();
  return flushNow();
}

/**
 * Saves unsaved inbox changes before the window closes instead of losing the
 * last debounce window. Mount once in an always-mounted component. The central
 * close guard registry owns the window listener and the timeout.
 */
export function useFlushOnClose() {
  useEffect(() => registerCloseGuard(flushBeforeClose), []);
}
