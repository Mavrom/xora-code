import type { MergedSection, Settings, SettingsPatch } from "./types";

const SECTIONS: readonly MergedSection[] = ["general", "agent", "editor", "terminal", "appearance"];

const sameMap = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Returns `settings` with `patch` applied per section (and `keybindings` replaced whole);
 * untouched sections keep their identity.
 */
export function applyPatch(settings: Settings, patch: SettingsPatch): Settings {
  let next = settings;
  if (patch.keybindings && !sameMap(patch.keybindings, settings.keybindings)) {
    next = { ...settings, keybindings: patch.keybindings };
  }
  for (const section of SECTIONS) {
    const changes = patch[section];
    if (!changes) continue;
    const current = settings[section] as unknown as Record<string, unknown>;
    const changed = Object.entries(changes).some(([key, value]) => current[key] !== value);
    if (!changed) continue;
    if (next === settings) next = { ...settings };
    (next as unknown as Record<string, unknown>)[section] = { ...current, ...changes };
  }
  return next;
}

/** Combines two pending patches; fields in `later` win (a later `keybindings` map whole). */
export function mergePatches(earlier: SettingsPatch, later: SettingsPatch): SettingsPatch {
  const out: SettingsPatch = { ...earlier };
  if (later.keybindings) out.keybindings = later.keybindings;
  for (const section of SECTIONS) {
    const value = later[section];
    if (!value) continue;
    (out as Record<string, unknown>)[section] = { ...earlier[section], ...value };
  }
  return out;
}

/** No change at all. A `keybindings` map counts even when empty: `{}` resets them all. */
export const isEmptyPatch = (patch: SettingsPatch) =>
  patch.keybindings === undefined &&
  SECTIONS.every((s) => !patch[s] || Object.keys(patch[s]).length === 0);
