import type { Settings, SettingsPatch } from "./types";

const SECTIONS = ["general", "agent", "editor", "appearance"] as const;

/** Returns `settings` with `patch` applied per section; untouched sections keep their identity. */
export function applyPatch(settings: Settings, patch: SettingsPatch): Settings {
  let next = settings;
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

/** Combines two pending patches; fields in `later` win. */
export function mergePatches(earlier: SettingsPatch, later: SettingsPatch): SettingsPatch {
  const out: SettingsPatch = { ...earlier };
  for (const section of SECTIONS) {
    const value = later[section];
    if (!value) continue;
    (out as Record<string, unknown>)[section] = { ...earlier[section], ...value };
  }
  return out;
}

export const isEmptyPatch = (patch: SettingsPatch) =>
  SECTIONS.every((s) => !patch[s] || Object.keys(patch[s]).length === 0);
