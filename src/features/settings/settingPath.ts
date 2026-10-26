// A setting addressed as "section.key" (e.g. "editor.fontSize"): lets a row know whether
// it differs from the default, put it back, and be found by the settings search.
import { DEFAULT_SETTINGS, type Settings, type SettingsPatch } from "./types";

type Section = Exclude<keyof Settings, "version">;

export type SettingPath = {
  [S in Section]: `${S}.${Extract<keyof Settings[S], string>}`;
}[Section];

function split(path: SettingPath): [Section, string] {
  const dot = path.indexOf(".");
  return [path.slice(0, dot) as Section, path.slice(dot + 1)];
}

export function valueAt(settings: Settings, path: SettingPath): unknown {
  const [section, key] = split(path);
  return (settings[section] as unknown as Record<string, unknown>)[key];
}

/** Whether the stored value differs from the default (arrays compared by content). */
export function isModified(settings: Settings, path: SettingPath): boolean {
  return (
    JSON.stringify(valueAt(settings, path)) !== JSON.stringify(valueAt(DEFAULT_SETTINGS, path))
  );
}

/** The patch that puts one setting back to its default. */
export function resetPatch(path: SettingPath): SettingsPatch {
  const [section, key] = split(path);
  return { [section]: { [key]: valueAt(DEFAULT_SETTINGS, path) } } as SettingsPatch;
}

/** Every setting that differs from its default, among `paths`. */
export const modifiedPaths = (settings: Settings, paths: readonly SettingPath[]) =>
  paths.filter((p) => isModified(settings, p));
