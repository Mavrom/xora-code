import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { COMMANDS } from "@/features/commands/registry";
import { Kbd } from "@/shared/ui/Kbd";
import { SectionHeader, SettingGroup } from "../controls/SettingRow";
import { BUILTIN_SHORTCUTS, groupShortcuts } from "../shortcuts";

export function ShortcutsSection() {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupShortcuts([...BUILTIN_SHORTCUTS, ...COMMANDS], query), [query]);

  return (
    <>
      <SectionHeader
        title="Kısayollar"
        description="Komut paletindeki her komut ve klavye kısayolu. Kısayolları düzenleme ileride gelecek."
      />

      <label className="mt-8 flex h-9 items-center gap-2.5 rounded-md border border-border-strong bg-elevated px-3 transition-[border-color,box-shadow] duration-base focus-within:border-fg-subtle/60 focus-within:shadow-halo">
        <Search size={14} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Komut ya da tuş ara…"
          aria-label="Kısayollarda ara"
          spellCheck={false}
          className="h-full min-w-0 flex-1 bg-transparent text-ui text-fg outline-none placeholder:text-fg-subtle focus-visible:outline-none"
        />
      </label>

      {groups.length === 0 ? (
        <p className="py-10 text-center text-ui text-fg-muted">
          “{query.trim()}” ile eşleşen bir komut yok.
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
                  <span className="text-2xs text-fg-subtle">Atanmamış</span>
                )}
              </div>
            ))}
          </SettingGroup>
        ))
      )}
    </>
  );
}
