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
import { t } from "@/shared/i18n";

const TAB_SIZES = [
  { value: 2, label: "2" },
  { value: 4, label: "4" },
  { value: 8, label: "8" },
] as const;

const WHITESPACE: { value: RenderWhitespace; label: string }[] = [
  { value: "none", label: t("None") },
  { value: "boundary", label: t("Boundary") },
  { value: "all", label: t("All") },
];

const LINE_NUMBERS: { value: LineNumbers; label: string }[] = [
  { value: "on", label: t("On") },
  { value: "relative", label: t("Relative") },
  { value: "off", label: t("Off") },
];

const CURSORS: { value: CursorStyle; label: string }[] = [
  { value: "line", label: t("Line") },
  { value: "block", label: t("Block") },
  { value: "underline", label: t("Underline") },
];

const AUTO_SAVE: { value: AutoSave; label: string }[] = [
  { value: "off", label: t("Off") },
  { value: "delay", label: t("After a pause") },
  { value: "focusChange", label: t("On focus change") },
];

export function EditorSection() {
  const editor = useSettingsStore((s) => s.settings.editor);
  const update = useSettingsStore((s) => s.update);
  const set = (patch: Partial<EditorSettings>) => update({ editor: patch });

  return (
    <>
      <SectionHeader
        title={t("Editor")}
        description={t(
          "How the code editor looks and behaves. Changes apply to open tabs right away.",
        )}
      />

      <EditorPreview settings={editor} />

      <SettingGroup title={t("Text")}>
        <SettingRow
          label={t("Font size")}
          setting="editor.fontSize"
          description={t("Size of the code in the editor.")}
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
          label={t("Ligatures")}
          setting="editor.ligatures"
          description={t("Draws symbols like =>, !== and -> as single glyphs.")}
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={editor.ligatures}
              onChange={(ligatures) => set({ ligatures })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title={t("Cursor and gutter")}>
        <SettingRow
          label={t("Line numbers")}
          setting="editor.lineNumbers"
          description={t("Relative shows the distance from the cursor's line.")}
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
          label={t("Cursor style")}
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
          label={t("Sticky scroll")}
          setting="editor.stickyScroll"
          description={t(
            "Keeps the enclosing class and function headers at the top while scrolling.",
          )}
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={editor.stickyScroll}
              onChange={(stickyScroll) => set({ stickyScroll })}
            />
          )}
        />
        <SettingRow
          label={t("Bracket colors")}
          setting="editor.bracketColors"
          description={t(
            "Colors matching brackets by depth and draws a guide for the active pair.",
          )}
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={editor.bracketColors}
              onChange={(bracketColors) => set({ bracketColors })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title={t("Layout")}>
        <SettingRow
          label={t("Tab size")}
          setting="editor.tabSize"
          description={t("How many spaces one indent counts as.")}
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
          label={t("Word wrap")}
          setting="editor.wordWrap"
          description={t("Long lines wrap instead of scrolling sideways.")}
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={editor.wordWrap}
              onChange={(wordWrap) => set({ wordWrap })}
            />
          )}
        />
        <SettingRow
          label={t("Minimap")}
          setting="editor.minimap"
          description={t("Shows a small overview of the file on the right edge.")}
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={editor.minimap}
              onChange={(minimap) => set({ minimap })}
            />
          )}
        />
        <SettingRow
          label={t("Show whitespace")}
          setting="editor.renderWhitespace"
          description={t("Draws spaces and tabs as faint marks.")}
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

      <SettingGroup title={t("Saving")}>
        <SettingRow
          label={t("Auto save")}
          setting="editor.autoSave"
          description={t(
            "After a pause: a second after you stop typing. On focus change: when you leave the editor or Xora. Files changed on disk are never auto-saved.",
          )}
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
          label={t("Format on save")}
          setting="editor.formatOnSave"
          description={t(
            "Runs the formatter for the file's language, if there is one, before saving.",
          )}
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
  [["cm", "// Xora preview"]],
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
      aria-label={t("Editor preview")}
      className="mt-8 overflow-hidden rounded-lg border border-border bg-bg shadow-well"
    >
      <div className="flex h-8 items-center gap-2 border-b border-border px-3">
        <span className="size-1.5 rounded-full bg-border-strong" aria-hidden />
        <span className="text-2xs text-fg-subtle">greet.ts</span>
        <span className="ml-auto text-2xs text-fg-subtle tabular-nums">
          {t("{size}px · {tab} spaces", { size: settings.fontSize, tab: settings.tabSize })}
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
