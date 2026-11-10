import { ACTIONS, actionDef, isActionId } from "@/features/keymap/actions";
import { shortcutOf, type KeymapOverrides } from "@/features/keymap/keymap";

export interface ShortcutSource {
  id: string;
  title: string;
  group: string;
  shortcut?: string;
}

export interface ShortcutGroup {
  group: string;
  items: { id: string; title: string; shortcut: string | null }[];
}

/**
 * The rows of the shortcut list: the command palette first (it cannot list itself), then
 * every palette command in registry order with its binding from the keymap, then the
 * bindable actions that are not palette commands.
 */
export function shortcutSources(
  commands: readonly { id: string; title: string; group: string }[],
  overrides?: KeymapOverrides,
): ShortcutSource[] {
  const fromKeymap = (id: string) => (isActionId(id) ? shortcutOf(id, overrides) : undefined);
  const listed = new Set(commands.map((c) => c.id));
  const actions = ACTIONS.filter((a) => !listed.has(a.id)).map((a) => {
    const def = actionDef(a.id);
    return {
      id: a.id,
      title: def.title ?? a.id,
      group: def.group ?? "",
      shortcut: shortcutOf(a.id, overrides),
    };
  });
  const isPalette = (s: ShortcutSource) => s.id === "palette.open";
  return [
    ...actions.filter(isPalette),
    ...commands.map((c) => ({
      id: c.id,
      title: c.title,
      group: c.group,
      shortcut: fromKeymap(c.id),
    })),
    ...actions.filter((s) => !isPalette(s)),
  ];
}

const normalize = (s: string) => s.toLocaleLowerCase("tr");

/**
 * Groups commands for the read-only shortcut list, keeping registry order, and
 * filters by title, group or key text. Commands without a binding stay listed.
 */
export function groupShortcuts(commands: readonly ShortcutSource[], query = ""): ShortcutGroup[] {
  const q = normalize(query.trim());
  const groups = new Map<string, ShortcutGroup>();
  for (const command of commands) {
    const haystack = normalize(`${command.title} ${command.group} ${command.shortcut ?? ""}`);
    if (q && !haystack.includes(q)) continue;
    let group = groups.get(command.group);
    if (!group) {
      group = { group: command.group, items: [] };
      groups.set(command.group, group);
    }
    group.items.push({ id: command.id, title: command.title, shortcut: command.shortcut ?? null });
  }
  return [...groups.values()];
}
