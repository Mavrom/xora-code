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

/** Bindings that live outside the command registry (the palette cannot list itself). */
export const BUILTIN_SHORTCUTS: ShortcutSource[] = [
  { id: "palette.open", title: "Komut paleti", group: "Genel", shortcut: "mod+k" },
];

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
