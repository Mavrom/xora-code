// What the settings search can find. One entry per row a person would look for, with the
// words they might type (Turkish and the usual English terms). `setting` is the row to land
// on; entries without one open the section at the top.
import type { SettingPath } from "./settingPath";
import type { SettingsSection } from "./viewStore";

export interface SearchEntry {
  section: SettingsSection;
  label: string;
  setting?: SettingPath;
  keywords?: string;
}

export const SEARCH_INDEX: SearchEntry[] = [
  {
    section: "accounts",
    label: "Hesaplar",
    keywords: "giriş login abonelik claude codex gemini bağla",
  },
  {
    section: "accounts",
    label: "ANTHROPIC_API_KEY'i yok say",
    setting: "agent.claudeIgnoreApiKey",
    keywords: "api key anahtar",
  },
  {
    section: "agent",
    label: "Varsayılan ajan",
    setting: "agent.defaultAgent",
    keywords: "claude codex gemini",
  },
  {
    section: "agent",
    label: "Varsayılan mod",
    setting: "agent.defaultMode",
    keywords: "plan sohbet ajan mode",
  },
  {
    section: "agent",
    label: "Düşünme eforu",
    setting: "agent.defaultEffort",
    keywords: "effort reasoning düşünme",
  },
  {
    section: "agent",
    label: "Görünen modeller",
    setting: "agent.hiddenModels",
    keywords: "model gizle göster liste opus sonnet gpt",
  },
  {
    section: "agent",
    label: "Onay politikası",
    setting: "agent.approvalPolicy",
    keywords: "izin permission onay otomatik yolo",
  },
  {
    section: "agent",
    label: "Ayrıntılı ajan günlükleri",
    setting: "agent.debugLogs",
    keywords: "log debug günlük hata",
  },
  {
    section: "general",
    label: "Mesajı gönder",
    setting: "general.sendKey",
    keywords: "enter ctrl gönder yeni satır send",
  },
  {
    section: "general",
    label: "Sohbet yazı boyutu",
    setting: "general.chatFontSize",
    keywords: "font yazı büyüt küçült mesaj",
  },
  {
    section: "general",
    label: "Bitince haber ver",
    setting: "general.notifyWhenDone",
    keywords: "bildirim notification görev çubuğu",
  },
  {
    section: "general",
    label: "Son klasörü aç",
    setting: "general.openLastFolder",
    keywords: "açılış başlangıç startup klasör",
  },
  {
    section: "general",
    label: "Kaydedilmemiş sekmeyi kapatırken sor",
    setting: "general.confirmDirtyClose",
    keywords: "kaydet uyarı kapat",
  },
  {
    section: "general",
    label: "Hareketi azalt",
    setting: "general.reducedMotion",
    keywords: "animasyon hareket erişilebilirlik motion",
  },
  {
    section: "appearance",
    label: "Arayüz ölçeği",
    setting: "appearance.uiScale",
    keywords: "zoom yakınlaştır büyüt ölçek boyut",
  },
  {
    section: "appearance",
    label: "Saydamlık",
    setting: "appearance.window",
    keywords: "şeffaf transparent acrylic buzlu opak cam",
  },
  {
    section: "appearance",
    label: "Koyuluk",
    setting: "appearance.tint",
    keywords: "karart saydamlık tint",
  },
  {
    section: "appearance",
    label: "Görsel göster",
    setting: "appearance.picture",
    keywords: "duvar kağıdı wallpaper resim arka plan",
  },
  {
    section: "appearance",
    label: "Efekt",
    setting: "appearance.effect",
    keywords: "ascii dither halftone tarama",
  },
  {
    section: "appearance",
    label: "Karartma",
    setting: "appearance.dim",
    keywords: "görsel koyulaştır",
  },
  {
    section: "editor",
    label: "Yazı boyutu",
    setting: "editor.fontSize",
    keywords: "font editör kod",
  },
  {
    section: "editor",
    label: "Ligatürler",
    setting: "editor.ligatures",
    keywords: "font ligature",
  },
  {
    section: "editor",
    label: "Satır numaraları",
    setting: "editor.lineNumbers",
    keywords: "line numbers göreli relative",
  },
  {
    section: "editor",
    label: "İmleç biçimi",
    setting: "editor.cursorStyle",
    keywords: "cursor imleç blok",
  },
  {
    section: "editor",
    label: "Yapışkan kaydırma",
    setting: "editor.stickyScroll",
    keywords: "sticky scroll başlık",
  },
  {
    section: "editor",
    label: "Parantez renkleri",
    setting: "editor.bracketColors",
    keywords: "bracket parantez renk kılavuz",
  },
  {
    section: "editor",
    label: "Sekme genişliği",
    setting: "editor.tabSize",
    keywords: "tab girinti indent boşluk",
  },
  {
    section: "editor",
    label: "Satır kaydırma",
    setting: "editor.wordWrap",
    keywords: "word wrap kaydır uzun satır",
  },
  { section: "editor", label: "Mini harita", setting: "editor.minimap", keywords: "minimap" },
  {
    section: "editor",
    label: "Boşlukları göster",
    setting: "editor.renderWhitespace",
    keywords: "whitespace boşluk sekme",
  },
  {
    section: "editor",
    label: "Otomatik kaydet",
    setting: "editor.autoSave",
    keywords: "auto save kaydet",
  },
  {
    section: "editor",
    label: "Kaydederken biçimlendir",
    setting: "editor.formatOnSave",
    keywords: "format prettier biçim",
  },
  {
    section: "terminal",
    label: "Varsayılan kabuk",
    setting: "terminal.shell",
    keywords: "shell powershell cmd bash git",
  },
  {
    section: "terminal",
    label: "Terminal yazı boyutu",
    setting: "terminal.fontSize",
    keywords: "font terminal",
  },
  { section: "shortcuts", label: "Kısayollar", keywords: "kısayol tuş keyboard shortcut" },
  { section: "about", label: "Hakkında", keywords: "sürüm version lisans güncelle" },
];

/** Lower-case and strip Turkish diacritics, so "gorsel" finds "Görsel". */
export function fold(text: string): string {
  return text.toLocaleLowerCase("tr").replace(/ı/g, "i").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Entries matching every word of `query`, label matches first. */
export function searchSettings(query: string, index: readonly SearchEntry[] = SEARCH_INDEX) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored = index.flatMap((entry) => {
    const label = fold(entry.label);
    const hay = `${label} ${fold(entry.keywords ?? "")}`;
    if (!words.every((w) => hay.includes(w))) return [];
    const score = words.every((w) => label.includes(w)) ? (label.startsWith(words[0]) ? 0 : 1) : 2;
    return [{ entry, score }];
  });
  return scored.sort((a, b) => a.score - b.score).map((s) => s.entry);
}
