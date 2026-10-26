import { NumberInput } from "../controls/NumberInput";
import { Select } from "../controls/Select";
import { SectionHeader, SettingGroup, SettingRow } from "../controls/SettingRow";
import { useSettingsStore } from "../store";
import { FONT_SIZE_RANGE, type ShellKind, type TerminalSettings } from "../types";

const SHELLS: { value: ShellKind; label: string; hint?: string }[] = [
  { value: "auto", label: "Otomatik", hint: "PowerShell 7, yoksa Windows PowerShell" },
  { value: "pwsh", label: "PowerShell 7" },
  { value: "powerShell", label: "Windows PowerShell" },
  { value: "cmd", label: "Komut İstemi" },
  { value: "gitBash", label: "Git Bash" },
];

export function TerminalSection() {
  const terminal = useSettingsStore((s) => s.settings.terminal);
  const update = useSettingsStore((s) => s.update);
  const set = (patch: Partial<TerminalSettings>) => update({ terminal: patch });

  return (
    <>
      <SectionHeader
        title="Terminal"
        description="Ctrl+` ile açılan yerleşik terminal. Kabuk yeni açılan terminallerde, yazı boyutu açık olanlarda da hemen uygulanır."
      />

      <SettingGroup title="Kabuk">
        <SettingRow
          label="Varsayılan kabuk"
          setting="terminal.shell"
          description="Seçtiğin kabuk kurulu değilse otomatik seçime döner."
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

      <SettingGroup title="Yazı">
        <SettingRow
          label="Yazı boyutu"
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
