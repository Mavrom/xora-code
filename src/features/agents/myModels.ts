// Which models an agent's picker offers ("my models"), from the user's own list, an older
// hidden-models setting, or sensible defaults. Pure.
import type { SelectControl } from "./controls";
import { modelKey, type ModelEntry } from "./modelCatalog";
import type { AgentId } from "./types";

type Option = SelectControl["options"][number];

/** How many models an agent offers before the user picks their own. */
export const DEFAULT_MODEL_COUNT = 3;

const isDefaultEntry = (m: ModelEntry) => m.value === "default" || /^default$/i.test(m.name);

/** The agent's default entry (or its first model) first, then the next ones: three in all. */
export function defaultModels(catalog: readonly ModelEntry[]): string[] {
  const first = catalog.find(isDefaultEntry) ?? catalog[0];
  if (!first) return [];
  const rest = catalog.filter((m) => m !== first).map((m) => m.value);
  return [first.value, ...rest].slice(0, DEFAULT_MODEL_COUNT);
}

/**
 * An agent's list: the user's own when set; else, for someone who hid models in an older
 * version, every listed model they did not hide (nothing lost); else the defaults.
 */
export function effectiveModels(
  agent: AgentId,
  stored: readonly string[] | null,
  catalog: readonly ModelEntry[],
  hidden: readonly string[],
): string[] {
  if (stored) return [...stored];
  const prefix = `${agent}:`;
  if (hidden.some((k) => k.startsWith(prefix))) {
    const skip = new Set(hidden);
    return catalog.filter((m) => !skip.has(modelKey(agent, m.value))).map((m) => m.value);
  }
  return defaultModels(catalog);
}

/** A model the user added by id that the agent did not list. */
export interface PickerOption extends Option {
  custom?: boolean;
}

/**
 * The composer's Model row: the user's models in their order, each as the agent lists it
 * (or by its bare id when added by hand), plus the model in use when it is not among them,
 * so the row never hides what is active.
 */
export function pickerModels(control: SelectControl, mine: readonly string[]): PickerOption[] {
  const listed = new Map(control.options.map((o) => [o.value, o]));
  const out: PickerOption[] = mine.map(
    (id) => listed.get(id) ?? { value: id, name: id, custom: true },
  );
  if (!mine.includes(control.current)) {
    out.push(listed.get(control.current) ?? { value: control.current, name: control.current });
  }
  return out;
}

/** Why a hand-typed model id cannot be added, or null when it can. */
export function addProblem(id: string, mine: readonly string[]): "empty" | "duplicate" | null {
  const value = id.trim();
  if (value === "") return "empty";
  return mine.includes(value) ? "duplicate" : null;
}
