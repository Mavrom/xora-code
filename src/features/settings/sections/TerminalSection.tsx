import { NumberInput } from "../controls/NumberInput";
import { Select } from "../controls/Select";
import { SectionHeader, SettingGroup, SettingRow } from "../controls/SettingRow";
import { useSettingsStore } from "../store";
import { FONT_SIZE_RANGE, type ShellKind, type TerminalSettings } from "../types";
import { t } from "@/shared/i18n";

const SHELLS: { value: ShellKind; label: string; hint?: string }[] = [
  { value: "auto", label: t("Automatic"), hint: t("PowerShell 7, else Windows PowerShell") },
  { value: "pwsh", label: "PowerShell 7" },
  { value: "powerShell", label: "Windows PowerShell" },
  { value: "cmd", label: t("Command Prompt") },
  { value: "gitBash", label: "Git Bash" },
];

export function TerminalSection() {
  const terminal = useSettingsStore((s) => s.settings.terminal);
  const update = useSettingsStore((s) => s.update);
  const set = (patch: Partial<TerminalSettings>) => update({ terminal: patch });

  return (
    <>
      <SectionHeader
        title={t("Terminal")}
        description={t(
          "The built-in terminal, opened with Ctrl+`. The shell applies to new terminals; the font size also applies to open ones right away.",
        )}
      />

      <SettingGroup title={t("Shell")}>
        <SettingRow
          label={t("Default shell")}
          setting="terminal.shell"
          description={t(
            "Falls back to the automatic choice when the selected shell is not installed.",
          )}
          control={(id) => (
            <Select
              labelledBy={id}
              value={terminal.shell}
              options={SHELLS}
              onChange={(shell) => set({ shell })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title={t("Text")}>
        <SettingRow
          label={t("Font size")}
          setting="terminal.fontSize"
          control={(id) => (
            <NumberInput
              labelledBy={id}
              value={terminal.fontSize}
              min={FONT_SIZE_RANGE.min}
              max={FONT_SIZE_RANGE.max}
              unit="px"
              onChange={(fontSize) => set({ fontSize })}
            />
          )}
        />
      </SettingGroup>
    </>
  );
}
