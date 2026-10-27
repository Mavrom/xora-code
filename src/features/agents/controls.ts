// Unifies the three ways agents expose model / mode / effort (design 4.4):
// ACP `configOptions` (Claude, Codex) win; otherwise the legacy `modes` and
// Gemini's unstable `models` field are used. Pure, no IPC.

import type { AcpConfigOption, AcpSelectGroup, AcpSelectOption, SessionSetup } from "./types";
import { t } from "@/shared/i18n";

export interface SelectControl {
  /** configId, or "legacy-mode" / "legacy-model". */
  key: string;
  /** Which RPC sets it: `session/set_config_option`, `session/set_mode` or `session/set_model`. */
  via: "config" | "mode" | "model";
  label: string;
  current: string;
  options: { value: string; name: string; description?: string; group?: string }[];
}

export interface ToggleControl {
  key: string;
  via: "config";
  label: string;
  current: boolean;
  /** Always true: a native boolean config option (set with a boolean value). */
  boolean: boolean;
}

export type Control = SelectControl | ToggleControl;

export interface SessionControls {
  model?: SelectControl;
  mode?: SelectControl;
  effort?: SelectControl;
  /** "model_config", "_*", unknown categories and duplicates, in agent order. */
  extra: Control[];
}

/** The raw control state a session keeps; controls are derived from it. */
export type ControlSource = Pick<SessionSetup, "configOptions" | "modes" | "models">;

export const LEGACY_MODE_KEY = "legacy-mode";
export const LEGACY_MODEL_KEY = "legacy-model";

const isGroup = (o: AcpSelectOption | AcpSelectGroup): o is AcpSelectGroup =>
  Array.isArray((o as AcpSelectGroup).options);

function option(
  value: string,
  name: string,
  description?: string | null,
  group?: string,
): SelectControl["options"][number] {
  const out: SelectControl["options"][number] = { value, name };
  if (description) out.description = description;
  if (group) out.group = group;
  return out;
}

function configControl(opt: AcpConfigOption): Control {
  if (opt.type === "boolean") {
    return {
      key: opt.id,
      via: "config",
      label: opt.name,
      current: opt.currentValue,
      boolean: true,
    };
  }
  const options = (opt.options as (AcpSelectOption | AcpSelectGroup)[]).flatMap((o) =>
    isGroup(o)
      ? o.options.map((inner) => option(inner.value, inner.name, inner.description, o.name))
      : [option(o.value, o.name, o.description)],
  );
  return { key: opt.id, via: "config", label: opt.name, current: opt.currentValue, options };
}

const SLOT_BY_CATEGORY: Record<string, "model" | "mode" | "effort"> = {
  model: "model",
  mode: "mode",
  thought_level: "effort",
};

/** Derives the selector model for a session. */
export function deriveControls(source: ControlSource): SessionControls {
  const out: SessionControls = { extra: [] };
  const { configOptions, modes, models } = source;

  if (configOptions && configOptions.length > 0) {
    for (const opt of configOptions) {
      const control = configControl(opt);
      const slot = opt.category ? SLOT_BY_CATEGORY[opt.category] : undefined;
      if (slot && !out[slot] && "options" in control) out[slot] = control;
      else out.extra.push(control);
    }
    return out;
  }

  if (modes && modes.availableModes.length > 0) {
    out.mode = {
      key: LEGACY_MODE_KEY,
      via: "mode",
      label: t("Mode"),
      current: modes.currentModeId,
      options: modes.availableModes.map((m) => option(m.id, m.name, m.description)),
    };
  }
  if (models && models.availableModels.length > 0) {
    out.model = {
      key: LEGACY_MODEL_KEY,
      via: "model",
      label: t("Model"),
      current: models.currentModelId,
      options: models.availableModels.map((m) => option(m.modelId, m.name, m.description)),
    };
  }
  return out;
}

/** Finds a control by key in any slot. */
export function findControl(controls: SessionControls, key: string): Control | undefined {
  for (const c of [controls.model, controls.mode, controls.effort, ...controls.extra]) {
    if (c?.key === key) return c;
  }
  return undefined;
}

/**
 * Returns a new source with one value changed (optimistic update before the
 * agent confirms). Config option responses replace the whole list instead,
 * since a model change can change the effort options too.
 */
export function applyControlValue(
  source: ControlSource,
  key: string,
  via: Control["via"],
  value: string | boolean,
): ControlSource {
  if (via === "config") {
    const list = source.configOptions;
    const idx = list?.findIndex((o) => o.id === key) ?? -1;
    if (!list || idx < 0) return source;
    const next = list.slice();
    next[idx] = { ...list[idx], currentValue: value } as AcpConfigOption;
    return { ...source, configOptions: next };
  }
  if (via === "mode" && source.modes && typeof value === "string") {
    return { ...source, modes: { ...source.modes, currentModeId: value } };
  }
  if (via === "model" && source.models && typeof value === "string") {
    return { ...source, models: { ...source.models, currentModelId: value } };
  }
  return source;
}
