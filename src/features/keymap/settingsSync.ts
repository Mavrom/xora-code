// The keymap follows `settings.keybindings`: a change in Settings > Shortcuts is saved like
// any other setting and applies at once, with no reload.
import { useSettingsStore } from "@/features/settings/store";
import type { ActionId } from "./actions";
import { setKeymapOverrides, useKeymap } from "./keymap";
import { sanitizeOverrides, withBindings, withoutOverride } from "./overrides";

type SettingsStore = typeof useSettingsStore;

/** Keeps the keymap in step with the stored overrides; returns the unsubscribe function. */
export function installKeymap(store: SettingsStore = useSettingsStore) {
  let last: unknown = null;
  const sync = () => {
    const stored = store.getState().settings.keybindings;
    if (stored === last) return;
    last = stored;
    setKeymapOverrides(sanitizeOverrides(stored));
  };
  sync();
  return store.subscribe(sync);
}

const save = (overrides: ReturnType<typeof useKeymap.getState>["overrides"]) =>
  useSettingsStore.getState().update({ keybindings: overrides as Record<string, string | null> });

/** Binds actions (a binding in canonical form, or `null` to unbind) in one save. */
export function saveBindings(changes: Partial<Record<ActionId, string | null>>) {
  save(withBindings(useKeymap.getState().overrides, changes));
}

/** Puts one action back on its default bindings. */
export function resetBinding(id: ActionId) {
  save(withoutOverride(useKeymap.getState().overrides, id));
}

/** Puts every action back on its default bindings. */
export function resetAllBindings() {
  save({});
}
