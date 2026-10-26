import { NumberInput } from "../controls/NumberInput";
import { Segmented } from "../controls/Segmented";
import { SectionHeader, SettingGroup, SettingRow } from "../controls/SettingRow";
import { Toggle } from "../controls/Toggle";
import { useSettingsStore } from "../store";
import { CHAT_FONT_SIZE_RANGE, type ReducedMotion, type SendKey } from "../types";

const SEND_KEYS: { value: SendKey; label: string }[] = [
  { value: "enter", label: "Enter" },
  { value: "ctrlEnter", label: "Ctrl+Enter" },
];

const MOTION: { value: ReducedMotion; label: string }[] = [
  { value: "system", label: "Sistem" },
  { value: "always", label: "Her zaman" },
  { value: "never", label: "Asla" },
];

export function GeneralSection() {
  const general = useSettingsStore((s) => s.settings.general);
  const update = useSettingsStore((s) => s.update);

  return (
    <>
      <SectionHeader
        title="Genel"
        description="Xora'nın açılışta ve gündelik kullanımda nasıl davrandığı."
      />

      <SettingGroup title="Başlangıç">
        <SettingRow
          label="Son klasörü aç"
          setting="general.openLastFolder"
          description="Xora açıldığında en son çalıştığınız klasörle devam eder."
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={general.openLastFolder}
              onChange={(openLastFolder) => update({ general: { openLastFolder } })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title="Sohbet">
        <SettingRow
          label="Mesajı gönder"
          setting="general.sendKey"
          description={
            general.sendKey === "enter"
              ? "Enter gönderir, Shift+Enter alt satıra geçer."
              : "Ctrl+Enter gönderir, Enter alt satıra geçer. Uzun mesajlar yazarken rahat."
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
          label="Sohbet yazı boyutu"
          setting="general.chatFontSize"
          description="Mesajların ve ajan yanıtlarının yazı boyutu."
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

      <SettingGroup title="Bildirim">
        <SettingRow
          label="Bitince haber ver"
          setting="general.notifyWhenDone"
          description="Xora arka plandayken ajan işini bitirince ya da onay isteyince görev çubuğunda yanıp söner."
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={general.notifyWhenDone}
              onChange={(notifyWhenDone) => update({ general: { notifyWhenDone } })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title="Düzenleme">
        <SettingRow
          label="Kaydedilmemiş sekmeyi kapatırken sor"
          setting="general.confirmDirtyClose"
          description="Kapalıyken kaydedilmemiş değişiklikler sorulmadan atılır."
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={general.confirmDirtyClose}
              onChange={(confirmDirtyClose) => update({ general: { confirmDirtyClose } })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title="Erişilebilirlik">
        <SettingRow
          label="Hareketi azalt"
          setting="general.reducedMotion"
          description="Sistem, işletim sisteminin ayarını izler. Her zaman, geçiş animasyonlarını kapatır."
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
