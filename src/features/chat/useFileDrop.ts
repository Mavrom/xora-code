import { useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useSettingsView } from "@/features/settings/viewStore";

/**
 * Files and folders dragged onto the window from Explorer (Tauri's drag-and-drop event;
 * WebView2 does not hand real paths to HTML drop events). Returns whether something is
 * being dragged over; `onDrop` gets the dropped paths. Ignored while Settings is open.
 */
export function useFileDrop(onDrop: (paths: string[]) => void): boolean {
  const [over, setOver] = useState(false);
  const latest = useRef(onDrop);
  useEffect(() => {
    latest.current = onDrop;
  });

  useEffect(() => {
    let alive = true;
    let off: (() => void) | undefined;
    try {
      void getCurrentWebview()
        .onDragDropEvent(({ payload }) => {
          if (useSettingsView.getState().open) return;
          if (payload.type === "enter" || payload.type === "over") setOver(true);
          else if (payload.type === "leave") setOver(false);
          else if (payload.type === "drop") {
            setOver(false);
            if (payload.paths.length > 0) latest.current(payload.paths);
          }
        })
        .then((unlisten) => {
          if (alive) off = unlisten;
          else unlisten();
        })
        .catch(() => undefined);
    } catch {
      // Outside Tauri (tests, plain browser): no file drops.
    }
    return () => {
      alive = false;
      off?.();
    };
  }, []);

  return over;
}
