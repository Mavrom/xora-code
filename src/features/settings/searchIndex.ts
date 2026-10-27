// What the settings search can find. One entry per row a person would look for, with the
// words they might type (Turkish and the usual English terms). `setting` is the row to land
// on; entries without one open the section at the top.
import type { SettingPath } from "./settingPath";
import type { SettingsSection } from "./viewStore";
import { t } from "@/shared/i18n";

export interface SearchEntry {
  section: SettingsSection;
  label: string;
  setting?: SettingPath;
  keywords?: string;
}

export const SEARCH_INDEX: SearchEntry[] = [
  {
    section: "accounts",
    label: t("Accounts"),
    keywords: "giriş login abonelik claude codex gemini bağla",
  },
  {
    section: "accounts",
    label: t("Ignore ANTHROPIC_API_KEY"),
    setting: "agent.claudeIgnoreApiKey",
    keywords: "api key anahtar",
  },
  {
    section: "agent",
    label: t("Default agent"),
    setting: "agent.defaultAgent",
    keywords: "claude codex gemini",
  },
  {
    section: "agent",
    label: t("Default mode"),
    setting: "agent.defaultMode",
    keywords: "plan sohbet ajan mode",
  },
  {
    section: "agent",
    label: t("Thinking effort"),
    setting: "agent.defaultEffort",
    keywords: "effort reasoning düşünme",
  },
  {
    section: "agent",
    label: t("Visible models"),
    setting: "agent.hiddenModels",
    keywords: "model gizle göster liste opus sonnet gpt",
  },
  {
    section: "agent",
    label: t("Approval policy"),
    setting: "agent.approvalPolicy",
    keywords: "izin permission onay otomatik yolo",
  },
  {
    section: "agent",
    label: t("Verbose agent logs"),
    setting: "agent.debugLogs",
    keywords: "log debug günlük hata",
  },
  {
    section: "general",
    label: t("Interface language"),
    setting: "general.language",
    keywords: "language dil english türkçe turkish locale",
  },
  {
    section: "general",
    label: t("Send message with"),
    setting: "general.sendKey",
    keywords: "enter ctrl gönder yeni satır send",
  },
  {
    section: "general",
    label: t("Chat text size"),
    setting: "general.chatFontSize",
    keywords: "font yazı büyüt küçült mesaj",
  },
  {
    section: "general",
    label: t("Notify when done"),
    setting: "general.notifyWhenDone",
    keywords: "bildirim notification görev çubuğu",
  },
  {
    section: "general",
    label: t("Reopen last folder"),
    setting: "general.openLastFolder",
    keywords: "açılış başlangıç startup klasör",
  },
  {
    section: "general",
    label: t("Ask before closing an unsaved tab"),
    setting: "general.confirmDirtyClose",
    keywords: "kaydet uyarı kapat",
  },
  {
    section: "general",
    label: t("Reduce motion"),
    setting: "general.reducedMotion",
    keywords: "animasyon hareket erişilebilirlik motion",
  },
  {
    section: "appearance",
    label: t("Interface scale"),
    setting: "appearance.uiScale",
    keywords: "zoom yakınlaştır büyüt ölçek boyut",
  },
  {
    section: "appearance",
    label: t("Transparency"),
    setting: "appearance.window",
    keywords: "şeffaf transparent acrylic buzlu opak cam",
  },
  {
    section: "appearance",
    label: t("Darkness"),
    setting: "appearance.tint",
    keywords: "karart saydamlık tint",
  },
  {
    section: "appearance",
    label: t("Show picture"),
    setting: "appearance.picture",
    keywords: "duvar kağıdı wallpaper resim arka plan",
  },
  {
    section: "appearance",
    label: t("Effect"),
    setting: "appearance.effect",
    keywords: "ascii dither halftone tarama",
  },
  {
    section: "appearance",
    label: t("Dim"),
    setting: "appearance.dim",
    keywords: "görsel koyulaştır",
  },
  {
    section: "editor",
    label: t("Font size"),
    setting: "editor.fontSize",
    keywords: "font editör kod",
  },
  {
    section: "editor",
    label: t("Ligatures"),
    setting: "editor.ligatures",
    keywords: "font ligature",
  },
  {
    section: "editor",
    label: t("Line numbers"),
    setting: "editor.lineNumbers",
    keywords: "line numbers göreli relative",
  },
  {
    section: "editor",
    label: t("Cursor style"),
    setting: "editor.cursorStyle",
    keywords: "cursor imleç blok",
  },
  {
    section: "editor",
    label: t("Sticky scroll"),
    setting: "editor.stickyScroll",
    keywords: "sticky scroll başlık",
  },
  {
    section: "editor",
    label: t("Bracket colors"),
    setting: "editor.bracketColors",
    keywords: "bracket parantez renk kılavuz",
  },
  {
    section: "editor",
    label: t("Tab size"),
    setting: "editor.tabSize",
    keywords: "tab girinti indent boşluk",
  },
  {
    section: "editor",
    label: t("Word wrap"),
    setting: "editor.wordWrap",
    keywords: "word wrap kaydır uzun satır",
  },
  { section: "editor", label: t("Minimap"), setting: "editor.minimap", keywords: "minimap" },
  {
    section: "editor",
    label: t("Show whitespace"),
    setting: "editor.renderWhitespace",
    keywords: "whitespace boşluk sekme",
  },
  {
    section: "editor",
    label: t("Auto save"),
    setting: "editor.autoSave",
    keywords: "auto save kaydet",
  },
  {
    section: "editor",
    label: t("Format on save"),
    setting: "editor.formatOnSave",
    keywords: "format prettier biçim",
  },
  {
    section: "terminal",
    label: t("Default shell"),
    setting: "terminal.shell",
    keywords: "shell powershell cmd bash git",
  },
  {
    section: "terminal",
    label: t("Terminal font size"),
    setting: "terminal.fontSize",
    keywords: "font terminal",
  },
  { section: "shortcuts", label: t("Shortcuts"), keywords: "kısayol tuş keyboard shortcut" },
  { section: "about", label: t("About"), keywords: "sürüm version lisans güncelle" },
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
