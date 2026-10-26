// Window transparency (Settings > Görünüm > Pencere). The window is created transparent;
// "solid" paints it onyx, "frosted" adds Windows Acrylic (what is behind, blurred) and
// "clear" leaves it see-through. `--app-base` is the tint every surface sits on.
import { Effect, getCurrentWindow } from "@tauri-apps/api/window";
import { useSettingsStore } from "@/features/settings/store";
import type { AppearanceSettings } from "@/features/settings/types";

type Look = Pick<AppearanceSettings, "window" | "tint">;

/** The CSS colour under everything: opaque onyx, or black at `tint` percent. */
export function baseColor({ window, tint }: Look): string {
  if (window === "solid") return "#000000";
  const alpha = Math.min(100, Math.max(0, tint)) / 100;
  return `rgb(0 0 0 / ${alpha})`;
}

function apply(look: Look) {
  const root = document.documentElement;
  root.dataset.window = look.window;
  root.style.setProperty("--app-base", baseColor(look));
  try {
    const win = getCurrentWindow();
    const task =
      look.window === "frosted"
        ? win.setEffects({ effects: [Effect.Acrylic], color: [0, 0, 0, 0] })
        : win.clearEffects();
    task.catch((error: unknown) => console.error("Window effect failed", error));
  } catch {
    // Outside Tauri (tests, plain browser): the CSS tint alone.
  }
}

/** Applies the window look now and whenever it changes in Settings. */
export function installWindowLook(store = useSettingsStore) {
  let last = "";
  const sync = (appearance: AppearanceSettings) => {
    const key = `${appearance.window}:${appearance.tint}`;
    if (key === last) return;
    last = key;
    apply(appearance);
  };
  sync(store.getState().settings.appearance);
  return store.subscribe((state) => sync(state.settings.appearance));
}
