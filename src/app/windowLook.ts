// Window transparency (Settings > Görünüm > Pencere). The window is created transparent;
// "solid" paints it onyx, "frosted" adds Windows Acrylic or macOS vibrancy (what is behind,
// blurred) and
// "clear" leaves it see-through. `--app-base` is the tint every surface sits on.
import { Effect, EffectState, getCurrentWindow } from "@tauri-apps/api/window";
import { detectPlatform } from "@/shared/ui/keys";
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
    const task = look.window === "frosted" ? win.setEffects(frostedEffect()) : win.clearEffects();
    task.catch((error: unknown) => console.error("Window effect failed", error));
  } catch {
    // Outside Tauri (tests, plain browser): the CSS tint alone.
  }
}

function frostedEffect() {
  if (detectPlatform(navigator) === "mac") {
    // The dark HUD material; Active so the blur stays when the window loses focus.
    return { effects: [Effect.HudWindow], state: EffectState.Active };
  }
  // Acrylic's own tint: near-black, so a light desktop behind does not wash the
  // window out to grey; `--app-base` darkens further on top.
  return { effects: [Effect.Acrylic], color: [6, 6, 8, 150] as [number, number, number, number] };
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
