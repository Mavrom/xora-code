import { CaseSensitive, Regex, WholeWord, type LucideIcon } from "lucide-react";
import { IconButton } from "@/shared/ui/IconButton";
import { t } from "@/shared/i18n";
import type { SearchOptions } from "./ipc";
import { useSearchStore } from "./searchStore";

interface Toggle {
  option: keyof SearchOptions;
  icon: LucideIcon;
  label: string;
  /** Handled by the dialog, see `toggleFor`. */
  shortcut: string;
}

const TOGGLES: Toggle[] = [
  { option: "caseSensitive", icon: CaseSensitive, label: t("Match case"), shortcut: "alt+c" },
  { option: "wholeWord", icon: WholeWord, label: t("Match whole word"), shortcut: "alt+w" },
  { option: "regex", icon: Regex, label: t("Use regular expression"), shortcut: "alt+r" },
];

/** Match case, whole word and regex: pressed buttons (`aria-pressed`) beside the query. */
export function SearchToggles() {
  const pressed: SearchOptions = {
    caseSensitive: useSearchStore((s) => s.caseSensitive),
    wholeWord: useSearchStore((s) => s.wholeWord),
    regex: useSearchStore((s) => s.regex),
  };
  const { toggle } = useSearchStore.getState();
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {TOGGLES.map(({ option, icon, label, shortcut }) => (
        <IconButton
          key={option}
          icon={icon}
          label={label}
          shortcut={shortcut}
          size="sm"
          active={pressed[option]}
          onClick={() => toggle(option)}
        />
      ))}
    </div>
  );
}
