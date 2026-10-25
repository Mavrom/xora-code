import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { flushNow } from "./store";

/** A hung save must never keep the window from closing. */
const CLOSE_FLUSH_TIMEOUT_MS = 3_000;

/** Commits an open inline edit (its blur handler saves) and writes pending notes. */
async function flushBeforeClose() {
  (document.activeElement as HTMLElement | null)?.blur();
  await Promise.race([
    flushNow(),
    new Promise<void>((resolve) => setTimeout(resolve, CLOSE_FLUSH_TIMEOUT_MS)),
  ]);
}

/**
 * Saves unsaved inbox changes before the window closes instead of losing the
 * last debounce window. Mount once in an always-mounted component.
 */
export function useFlushOnClose() {
  useEffect(() => {
    // Best effort for reloads and plain-browser runs; cannot be awaited.
    const onPageHide = () => void flushBeforeClose();
    window.addEventListener("pagehide", onPageHide);

    let unlisten: (() => void) | undefined;
    let disposed = false;
    if (isTauri()) {
      // Tauri destroys the window once this handler settles (needs
      // `core:window:allow-destroy`); it must not throw or the window stays open.
      getCurrentWindow()
        .onCloseRequested(async () => {
          try {
            await flushBeforeClose();
          } catch (err) {
            console.error("inbox: flush on close failed", err);
          }
        })
        .then((fn) => {
          if (disposed) fn();
          else unlisten = fn;
        })
        .catch((err: unknown) => console.error("inbox: cannot watch window close", err));
    }

    return () => {
      disposed = true;
      window.removeEventListener("pagehide", onPageHide);
      unlisten?.();
    };
  }, []);
}
