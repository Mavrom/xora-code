import { NumberInput } from "../controls/NumberInput";
import { Segmented } from "../controls/Segmented";
import { SectionHeader, SettingGroup, SettingRow } from "../controls/SettingRow";
import { Toggle } from "../controls/Toggle";
import { useSettingsStore } from "../store";
import {
  FONT_SIZE_RANGE,
  type AutoSave,
  type CursorStyle,
  type EditorSettings,
  type LineNumbers,
  type RenderWhitespace,
} from "../types";

const TAB_SIZES = [
  { value: 2, label: "2" },
  { value: 4, label: "4" },
  { value: 8, label: "8" },
] as const;

const WHITESPACE: { value: RenderWhitespace; label: string }[] = [
  { value: "none", label: "Yok" },
  { value: "boundary", label: "Sınırlar" },
  { value: "all", label: "Tümü" },
];

const LINE_NUMBERS: { value: LineNumbers; label: string }[] = [
  { value: "on", label: "Açık" },
  { value: "relative", label: "Göreli" },
  { value: "off", label: "Kapalı" },
];

const CURSORS: { value: CursorStyle; label: string }[] = [
  { value: "line", label: "Çizgi" },
  { value: "block", label: "Blok" },
  { value: "underline", label: "Alt çizgi" },
];

const AUTO_SAVE: { value: AutoSave; label: string }[] = [
  { value: "off", label: "Kapalı" },
  { value: "delay", label: "Yazınca" },
  { value: "focusChange", label: "Odak değişince" },
];

export function EditorSection() {
  const editor = useSettingsStore((s) => s.settings.editor);
  const update = useSettingsStore((s) => s.update);
  const set = (patch: Partial<EditorSettings>) => update({ editor: patch });

  return (
    <>
      <SectionHeader
        title="Editör"
        description="Kod editörünün görünümü ve davranışı. Değişiklikler açık sekmelere anında uygulanır."
      />

      <EditorPreview settings={editor} />

      <SettingGroup title="Yazı">
        <SettingRow
          label="Yazı boyutu"
          setting="editor.fontSize"
          description="Editördeki kod yazısının boyutu."
          control={(id) => (
            <NumberInput
              labelledBy={id}
              value={editor.fontSize}
              min={FONT_SIZE_RANGE.min}
              max={FONT_SIZE_RANGE.max}
              unit="px"
              onChange={(fontSize) => set({ fontSize })}
            />
          )}
        />
        <SettingRow
          label="Ligatürler"
          setting="editor.ligatures"
          description="=>, !== ve -> gibi işaretleri tek bir glif olarak çizer."
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={editor.ligatures}
              onChange={(ligatures) => set({ ligatures })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title="İmleç ve kenar">
        <SettingRow
          label="Satır numaraları"
          setting="editor.lineNumbers"
          description="Göreli, imlecin bulunduğu satıra olan uzaklığı gösterir."
          control={(id) => (
            <Segmented
              labelledBy={id}
              value={editor.lineNumbers}
              options={LINE_NUMBERS}
              onChange={(lineNumbers) => set({ lineNumbers })}
            />
          )}
        />
        <SettingRow
          label="İmleç biçimi"
          setting="editor.cursorStyle"
          control={(id) => (
            <Segmented
              labelledBy={id}
              value={editor.cursorStyle}
              options={CURSORS}
              onChange={(cursorStyle) => set({ cursorStyle })}
            />
          )}
        />
        <SettingRow
          label="Yapışkan kaydırma"
          setting="editor.stickyScroll"
          description="Kaydırırken içinde bulunduğun sınıf ve fonksiyon başlıkları üstte kalır."
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={editor.stickyScroll}
              onChange={(stickyScroll) => set({ stickyScroll })}
            />
          )}
        />
        <SettingRow
          label="Parantez renkleri"
          setting="editor.bracketColors"
          description="Eşleşen parantezleri derinliğine göre renklendirir ve aktif çiftin kılavuzunu çizer."
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={editor.bracketColors}
              onChange={(bracketColors) => set({ bracketColors })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title="Düzen">
        <SettingRow
          label="Sekme genişliği"
          setting="editor.tabSize"
          description="Bir girintinin kaç boşluk sayılacağı."
          control={(id) => (
            <Segmented
              labelledBy={id}
              value={editor.tabSize}
              options={TAB_SIZES}
              onChange={(tabSize) => set({ tabSize })}
            />
          )}
        />
        <SettingRow
          label="Satır kaydırma"
          setting="editor.wordWrap"
          description="Uzun satırlar yatay kaydırma yerine alt satıra geçer."
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={editor.wordWrap}
              onChange={(wordWrap) => set({ wordWrap })}
            />
          )}
        />
        <SettingRow
          label="Mini harita"
          setting="editor.minimap"
          description="Sağ kenarda dosyanın küçük bir özetini gösterir."
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={editor.minimap}
              onChange={(minimap) => set({ minimap })}
            />
          )}
        />
        <SettingRow
          label="Boşlukları göster"
          setting="editor.renderWhitespace"
          description="Boşluk ve sekme karakterlerini soluk işaretlerle çizer."
          control={(id) => (
            <Segmented
              labelledBy={id}
              value={editor.renderWhitespace}
              options={WHITESPACE}
              onChange={(renderWhitespace) => set({ renderWhitespace })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title="Kaydetme">
        <SettingRow
          label="Otomatik kaydet"
          setting="editor.autoSave"
          description="Yazınca: yazmayı bıraktıktan bir saniye sonra. Odak değişince: editörden ya da Xora'dan çıkınca. Diskte değişmiş dosyalar asla otomatik kaydedilmez."
          control={(id) => (
            <Segmented
              labelledBy={id}
              value={editor.autoSave}
              options={AUTO_SAVE}
              onChange={(autoSave) => set({ autoSave })}
            />
          )}
        />
        <SettingRow
          label="Kaydederken biçimlendir"
          setting="editor.formatOnSave"
          description="Dosyanın dili için bir biçimlendirici varsa kaydetmeden önce çalıştırır."
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={editor.formatOnSave}
              onChange={(formatOnSave) => set({ formatOnSave })}
            />
          )}
        />
      </SettingGroup>
    </>
  );
}

type Token = [kind: "kw" | "fn" | "str" | "op" | "pl" | "cm", text: string];

/** A few lines of code that show size, ligatures, indentation and whitespace at a glance. */
const SAMPLE: Token[][] = [
  [["cm", "// Xora önizleme"]],
  [
    ["kw", "const "],
    ["fn", "greet"],
    ["op", " = "],
    ["pl", "(name) "],
    ["op", "=>"],
    ["pl", " {"],
  ],
  [
    ["kw", "if "],
    ["pl", "(name "],
    ["op", "!=="],
    ["pl", " "],
    ["str", '""'],
    ["pl", ") "],
    ["kw", "return "],
    ["str", "`Merhaba, ${name}`"],
    ["pl", ";"],
  ],
  [["pl", "};"]],
];

const TOKEN_CLASS: Record<Token[0], string> = {
  kw: "text-fg-muted",
  fn: "text-fg",
  str: "text-fg-muted italic",
  op: "text-fg",
  pl: "text-fg-muted",
  cm: "text-fg-subtle",
};

function EditorPreview({ settings }: { settings: EditorSettings }) {
  const indent = (depth: number) => {
    if (depth === 0) return null;
    const width = settings.tabSize * depth;
    if (settings.renderWhitespace === "none") return " ".repeat(width);
    return (
      <span aria-hidden className="text-fg-subtle/50">
        {"·".repeat(width)}
      </span>
    );
  };
  const depths = [0, 0, 1, 0];

  return (
    <figure
      aria-label="Editör önizlemesi"
      className="mt-8 overflow-hidden rounded-lg border border-border bg-bg shadow-well"
    >
      <div className="flex h-8 items-center gap-2 border-b border-border px-3">
        <span className="size-1.5 rounded-full bg-border-strong" aria-hidden />
        <span className="text-2xs text-fg-subtle">greet.ts</span>
        <span className="ml-auto text-2xs text-fg-subtle tabular-nums">
          {settings.fontSize}px · {settings.tabSize} boşluk
        </span>
      </div>
      <pre
        className="overflow-hidden py-3 font-mono leading-[1.6] whitespace-pre"
        style={{
          fontSize: settings.fontSize,
          fontVariantLigatures: settings.ligatures ? "normal" : "none",
          fontFeatureSettings: settings.ligatures ? undefined : '"liga" 0, "calt" 0',
        }}
      >
        {SAMPLE.map((line, i) => (
          <div key={i} className="flex">
            <span
              aria-hidden
              className="w-10 shrink-0 pr-4 text-right text-fg-subtle/60 tabular-nums select-none"
            >
              {i + 1}
            </span>
            <code className={settings.wordWrap ? "whitespace-pre-wrap" : undefined}>
              {indent(depths[i])}
              {line.map(([kind, text], j) => (
                <span key={j} className={TOKEN_CLASS[kind]}>
                  {text}
                </span>
              ))}
            </code>
          </div>
        ))}
      </pre>
    </figure>
  );
}
