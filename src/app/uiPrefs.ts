// Interface-wide preferences that are not a component's business: conversation text size
// (`--chat-text`, read by the transcript) and the interface zoom (webview zoom), plus the
// Ctrl + / Ctrl - / Ctrl 0 shortcuts that change the zoom.
import { getCurrentWebview } from "@tauri-apps/api/webview";
import type { KeyEventLike } from "@/features/keymap/binding";
import { matchesAction } from "@/features/keymap/keymap";
import { useSettingsStore } from "@/features/settings/store";
import { UI_SCALE_RANGE, type Settings } from "@/features/settings/types";

/** One step of Ctrl + / Ctrl -, percent. */
export const SCALE_STEP = 10;

/** The zoom after a Ctrl + (1), Ctrl - (-1) or Ctrl 0 (0) press, within range. */
export function nextScale(current: number, direction: -1 | 0 | 1): number {
  if (direction === 0) return 100;
  const next = Math.round(current / SCALE_STEP) * SCALE_STEP + direction * SCALE_STEP;
  return Math.min(UI_SCALE_RANGE.max, Math.max(UI_SCALE_RANGE.min, next));
}

/** Which zoom shortcut a key event is, if any (by default Ctrl + / Ctrl - / Ctrl 0). */
export function zoomDirection(e: KeyEventLike) {
  if (matchesAction(e, "view.zoomIn")) return 1 as const;
  if (matchesAction(e, "view.zoomOut")) return -1 as const;
  if (matchesAction(e, "view.zoomReset")) return 0 as const;
  return null;
}

function apply(settings: Settings) {
  const root = document.documentElement;
  root.style.setProperty("--chat-text", `${settings.general.chatFontSize}px`);
  try {
    void getCurrentWebview()
      .setZoom(settings.appearance.uiScale / 100)
      .catch(() => undefined);
  } catch {
    // Outside Tauri: no webview zoom.
  }
}

export function installUiPrefs(store = useSettingsStore) {
  let last = "";
  const sync = (settings: Settings) => {
    const key = `${settings.general.chatFontSize}:${settings.appearance.uiScale}`;
    if (key === last) return;
    last = key;
    apply(settings);
  };
  sync(store.getState().settings);
  const off = store.subscribe((state) => sync(state.settings));

  const onKeyDown = (e: KeyboardEvent) => {
    const direction = zoomDirection(e);
    if (direction === null || e.defaultPrevented) return;
    e.preventDefault();
    const { settings, update } = store.getState();
    update({ appearance: { uiScale: nextScale(settings.appearance.uiScale, direction) } });
  };
  // Capture phase so it also works while the editor or terminal has focus.
  window.addEventListener("keydown", onKeyDown, true);
  return () => {
    off();
    window.removeEventListener("keydown", onKeyDown, true);
  };
}
