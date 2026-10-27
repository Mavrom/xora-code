// Interface language (Settings > General > Language). The resolved language is cached so
// the next start renders in it before Settings load; a change reloads the window, so every
// string, also the ones built when a module loads, comes up in the new language.
import { useSettingsStore } from "@/features/settings/store";
import type { Language } from "@/features/settings/types";
import { getLanguage, rememberLanguage, systemLanguage, type Lang } from "@/shared/i18n";

export const resolveLanguage = (preference: Language): Lang =>
  preference === "auto" ? systemLanguage() : preference;

/** Follows the setting once Settings have loaded; reloads when the language changes. */
export function installLanguage(
  store = useSettingsStore,
  reload: () => void = () => window.location.reload(),
) {
  document.documentElement.lang = getLanguage();
  let reloading = false;
  const sync = () => {
    const state = store.getState();
    if (state.status !== "ready" || reloading) return;
    const next = resolveLanguage(state.settings.general.language);
    rememberLanguage(next);
    if (next === getLanguage()) return;
    reloading = true;
    // The choice is on disk before the window goes.
    void state.flush().then(reload);
  };
  sync();
  return store.subscribe(sync);
}
