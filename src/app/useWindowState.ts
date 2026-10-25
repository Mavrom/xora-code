import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Tracks whether the current Tauri window is maximized (false outside Tauri). */
export function useIsMaximized(): boolean {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const win = getCurrentWindow();
    let disposed = false;
    let pending = false;
    let unlisten: (() => void) | undefined;

    // Resize events fire continuously while dragging an edge; coalesce them per frame.
    const sync = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        win
          .isMaximized()
          .then((value) => {
            if (!disposed) setMaximized(value);
          })
          .catch((error: unknown) => console.error("Failed to read window state", error));
      });
    };

    sync();
    win
      .onResized(sync)
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch((error: unknown) => console.error("Failed to listen for window resize", error));

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return maximized;
}
