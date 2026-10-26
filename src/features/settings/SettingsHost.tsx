import { lazy, Suspense, useEffect } from "react";
import { registerCloseGuard } from "@/app/closeGuards";
import { isPaletteOpen } from "@/features/commands/paletteGuard";
import { applyMotion } from "./motion";
import { isSettingsShortcut } from "./settingsKeys";
import { ensureSettingsLoaded, useSettingsStore } from "./store";
import { useSettingsView } from "./viewStore";

// The settings page is only needed once someone opens it: keep it out of the entry chunk.
const SettingsView = lazy(() => import("./SettingsView"));

/**
 * Always-mounted slot for the settings feature: loads the stored settings at start,
 * applies app-wide ones (reduced motion), saves pending changes before the window
 * closes, owns Ctrl+, and renders the settings page while it is open.
 */
export function SettingsHost() {
  const open = useSettingsView((s) => s.open);

  useEffect(() => {
    void ensureSettingsLoaded();
    const unregister = registerCloseGuard(() => useSettingsStore.getState().flush());
    applyMotion(useSettingsStore.getState().settings.general.reducedMotion);
    const unsubscribe = useSettingsStore.subscribe((state, prev) => {
      if (state.settings.general.reducedMotion !== prev.settings.general.reducedMotion) {
        applyMotion(state.settings.general.reducedMotion);
      }
    });
    return () => {
      unregister();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || isPaletteOpen() || !isSettingsShortcut(e)) return;
      e.preventDefault();
      e.stopPropagation();
      useSettingsView.getState().toggleSettings();
    };
    // Capture phase so it also works while Monaco has focus.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <SettingsView />
    </Suspense>
  );
}
