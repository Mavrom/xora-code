import { NumberInput } from "../controls/NumberInput";
import { Segmented } from "../controls/Segmented";
import { SectionHeader, SettingGroup, SettingRow } from "../controls/SettingRow";
import { Toggle } from "../controls/Toggle";
import { useSettingsStore } from "../store";
import { CHAT_FONT_SIZE_RANGE, type Language, type ReducedMotion, type SendKey } from "../types";
import { t } from "@/shared/i18n";

// Each language is named in itself, so it can be found from either one.
const LANGUAGES: { value: Language; label: string }[] = [
  { value: "auto", label: t("System") },
  { value: "en", label: "English" },
  { value: "tr", label: "Türkçe" },
];

const SEND_KEYS: { value: SendKey; label: string }[] = [
  { value: "enter", label: "Enter" },
  { value: "ctrlEnter", label: "Ctrl+Enter" },
];

const MOTION: { value: ReducedMotion; label: string }[] = [
  { value: "system", label: t("System") },
  { value: "always", label: t("Always") },
  { value: "never", label: t("Never") },
];

export function GeneralSection() {
  const general = useSettingsStore((s) => s.settings.general);
  const update = useSettingsStore((s) => s.update);

  return (
    <>
      <SectionHeader
        title={t("General")}
        description={t("How Xora behaves on start and day to day.")}
      />

      <SettingGroup title={t("Language")}>
        <SettingRow
          label={t("Interface language")}
          setting="general.language"
          description={t(
            "System follows your computer's language. Changing it reloads the window.",
          )}
          control={(id) => (
            <Segmented
              labelledBy={id}
              value={general.language}
              options={LANGUAGES}
              onChange={(language) => update({ general: { language } })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title={t("Startup")}>
        <SettingRow
          label={t("Reopen last folder")}
          setting="general.openLastFolder"
          description={t("Xora opens with the folder you last worked in.")}
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={general.openLastFolder}
              onChange={(openLastFolder) => update({ general: { openLastFolder } })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title={t("Chat")}>
        <SettingRow
          label={t("Send message with")}
          setting="general.sendKey"
          description={
            general.sendKey === "enter"
              ? t("Enter sends, Shift+Enter starts a new line.")
              : t("Ctrl+Enter sends, Enter starts a new line. Comfortable for long messages.")
          }
          control={(id) => (
            <Segmented
              labelledBy={id}
              value={general.sendKey}
              options={SEND_KEYS}
              onChange={(sendKey) => update({ general: { sendKey } })}
            />
          )}
        />
        <SettingRow
          label={t("Chat text size")}
          setting="general.chatFontSize"
          description={t("Text size of messages and agent replies.")}
          control={(id) => (
            <NumberInput
              labelledBy={id}
              value={general.chatFontSize}
              min={CHAT_FONT_SIZE_RANGE.min}
              max={CHAT_FONT_SIZE_RANGE.max}
              unit="px"
              onChange={(chatFontSize) => update({ general: { chatFontSize } })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title={t("Notifications")}>
        <SettingRow
          label={t("Notify when done")}
          setting="general.notifyWhenDone"
          description={t(
            "While Xora is in the background, its taskbar button flashes when an agent finishes or asks for approval.",
          )}
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={general.notifyWhenDone}
              onChange={(notifyWhenDone) => update({ general: { notifyWhenDone } })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title={t("Editing")}>
        <SettingRow
          label={t("Ask before closing an unsaved tab")}
          setting="general.confirmDirtyClose"
          description={t("When off, unsaved changes are discarded without asking.")}
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={general.confirmDirtyClose}
              onChange={(confirmDirtyClose) => update({ general: { confirmDirtyClose } })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title={t("Accessibility")}>
        <SettingRow
          label={t("Reduce motion")}
          setting="general.reducedMotion"
          description={t(
            "System follows the operating system's setting. Always turns transition animations off.",
          )}
          control={(id) => (
            <Segmented
              labelledBy={id}
              value={general.reducedMotion}
              options={MOTION}
              onChange={(reducedMotion) => update({ general: { reducedMotion } })}
            />
          )}
        />
      </SettingGroup>
    </>
  );
}
