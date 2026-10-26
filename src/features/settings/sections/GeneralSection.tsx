import { Segmented } from "../controls/Segmented";
import { SectionHeader, SettingGroup, SettingRow } from "../controls/SettingRow";
import { Toggle } from "../controls/Toggle";
import { useSettingsStore } from "../store";
import type { ReducedMotion } from "../types";

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

      <SettingGroup title="Bildirim">
        <SettingRow
          label="Bitince haber ver"
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
