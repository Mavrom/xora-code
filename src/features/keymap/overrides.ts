// Pure edits of the user's override map (`settings.keybindings`). An entry exists only
// where the effective binding differs from the default, so "changed" is "has an entry".
import { actionDef, isBindable, type BindableId } from "./actions";
import { normalizeBinding } from "./binding";
import type { KeymapOverrides } from "./keymap";

/**
 * The stored map as the keymap reads it: unknown actions (neither in `ACTIONS` nor a
 * registered palette command) and unreadable bindings dropped.
 */
export function sanitizeOverrides(stored: Record<string, string | null>): KeymapOverrides {
  const out: KeymapOverrides = {};
  for (const [id, value] of Object.entries(stored)) {
    if (!isBindable(id)) continue;
    if (value === null) out[id] = null;
    else if (typeof value === "string") {
      const binding = normalizeBinding(value);
      if (binding) out[id] = binding;
    }
  }
  return out;
}

export const isOverridden = (overrides: KeymapOverrides, id: BindableId) =>
  Object.prototype.hasOwnProperty.call(overrides, id);

/** Whether `binding` (canonical, or null) is exactly what the action has by default. */
function isDefault(id: BindableId, binding: string | null) {
  const defaults = actionDef(id).defaults;
  return binding !== null && defaults.length === 1 && defaults[0] === binding;
}

/** `overrides` with each action set to its new binding (`null` unbinds). */
export function withBindings(
  overrides: KeymapOverrides,
  changes: Partial<Record<BindableId, string | null>>,
): KeymapOverrides {
  const next: KeymapOverrides = { ...overrides };
  for (const [id, binding] of Object.entries(changes) as [BindableId, string | null][]) {
    if (isDefault(id, binding)) delete next[id];
    else next[id] = binding;
  }
  return next;
}

/** `overrides` with the action back on its default bindings. */
export function withoutOverride(overrides: KeymapOverrides, id: BindableId): KeymapOverrides {
  const next: KeymapOverrides = { ...overrides };
  delete next[id];
  return next;
}
