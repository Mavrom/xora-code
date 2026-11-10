import { ACTIONS, actionDef, isActionId, type ActionId } from "@/features/keymap/actions";
import { shortcutsOf, type KeymapOverrides } from "@/features/keymap/keymap";
import { isOverridden } from "@/features/keymap/overrides";

export interface ShortcutSource {
  id: string;
  title: string;
  group: string;
  /** Effective bindings in canonical form; empty when unbound or not bindable. */
  shortcuts: string[];
  /** The keymap action behind the row; rows without one cannot be given a shortcut. */
  action?: ActionId;
  /** The user changed this action's binding. */
  modified?: boolean;
}

export interface ShortcutGroup {
  group: string;
  items: ShortcutSource[];
}

/**
 * The rows of the shortcut list: the command palette first (it cannot list itself), then
 * every palette command in registry order with its binding from the keymap, then the
 * bindable actions that are not palette commands.
 */
export function shortcutSources(
  commands: readonly { id: string; title: string; group: string }[],
  overrides: KeymapOverrides = {},
): ShortcutSource[] {
  const row = (id: string, title: string, group: string): ShortcutSource =>
    isActionId(id)
      ? {
          id,
          title,
          group,
          shortcuts: shortcutsOf(id, overrides),
          action: id,
          modified: isOverridden(overrides, id),
        }
      : { id, title, group, shortcuts: [] };
  const listed = new Set(commands.map((c) => c.id));
  const actions = ACTIONS.filter((a) => !listed.has(a.id)).map((a) => {
    const def = actionDef(a.id);
    return row(a.id, def.title ?? a.id, def.group ?? "");
  });
  const isPalette = (s: ShortcutSource) => s.id === "palette.open";
  return [
    ...actions.filter(isPalette),
    ...commands.map((c) => row(c.id, c.title, c.group)),
    ...actions.filter((s) => !isPalette(s)),
  ];
}

const normalize = (s: string) => s.toLocaleLowerCase("tr");

/**
 * Groups rows for the shortcut list, keeping their order, and filters by title, group or
 * key text (`labels` turns a binding into the words shown for it, e.g. "Ctrl+Shift+G").
 * Rows without a binding stay listed.
 */
export function groupShortcuts(
  rows: readonly ShortcutSource[],
  query = "",
  labels: (shortcut: string) => string = (s) => s,
): ShortcutGroup[] {
  const q = normalize(query.trim());
  const groups = new Map<string, ShortcutGroup>();
  for (const row of rows) {
    const keys = row.shortcuts.flatMap((s) => [s, labels(s)]).join(" ");
    const haystack = normalize(`${row.title} ${row.group} ${keys}`);
    if (q && !haystack.includes(q)) continue;
    let group = groups.get(row.group);
    if (!group) {
      group = { group: row.group, items: [] };
      groups.set(row.group, group);
    }
    group.items.push(row);
  }
  return [...groups.values()];
}
