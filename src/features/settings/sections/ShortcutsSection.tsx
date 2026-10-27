import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { COMMANDS } from "@/features/commands/registry";
import { Kbd } from "@/shared/ui/Kbd";
import { SectionHeader, SettingGroup } from "../controls/SettingRow";
import { BUILTIN_SHORTCUTS, groupShortcuts } from "../shortcuts";
import { t } from "@/shared/i18n";

export function ShortcutsSection() {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupShortcuts([...BUILTIN_SHORTCUTS, ...COMMANDS], query), [query]);

  return (
    <>
      <SectionHeader
        title={t("Shortcuts")}
        description={t(
          "Every command in the command palette and its keyboard shortcut. Editing shortcuts is coming later.",
        )}
      />

      <label className="mt-8 flex h-9 items-center gap-2.5 rounded-md border border-border-strong bg-elevated px-3 transition-[border-color,box-shadow] duration-base focus-within:border-fg-subtle/60 focus-within:shadow-halo">
        <Search size={14} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search commands or keys…")}
          aria-label={t("Search shortcuts")}
          spellCheck={false}
          className="h-full min-w-0 flex-1 bg-transparent text-ui text-fg outline-none placeholder:text-fg-subtle focus-visible:outline-none"
        />
      </label>

      {groups.length === 0 ? (
        <p className="py-10 text-center text-ui text-fg-muted">
          {t("No command matches “{query}”.", { query: query.trim() })}
        </p>
      ) : (
        groups.map((group) => (
          <SettingGroup key={group.group} title={group.group}>
            {group.items.map((item) => (
              <div key={item.id} className="flex h-10 items-center justify-between gap-4 px-4">
                <span className="truncate text-ui text-fg-muted">{item.title}</span>
                {item.shortcut ? (
                  <Kbd keys={item.shortcut} className="shrink-0" />
                ) : (
                  <span className="text-2xs text-fg-subtle">{t("Unassigned")}</span>
                )}
              </div>
            ))}
          </SettingGroup>
        ))
      )}
    </>
  );
}
