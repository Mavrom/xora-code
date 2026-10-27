import { useRef, useState, type KeyboardEvent } from "react";
import { useAutoGrow } from "@/shared/lib/autoGrow";
import { isImeComposing } from "@/shared/lib/ime";
import { Kbd } from "@/shared/ui/Kbd";
import { readDraft, writeDraft } from "./draft";
import { t } from "@/shared/i18n";

/** Lets the activity bar focus the composer for quick capture. */
export const INBOX_COMPOSER_ID = "inbox-composer";

interface NoteComposerProps {
  disabled: boolean;
  /** Returns whether the note was added; the text is kept otherwise. */
  onSubmit: (text: string) => boolean;
}

/**
 * Quick-capture input: Enter adds, Shift+Enter breaks the line, Esc steps away.
 * Unsent text is kept in localStorage so it survives a restart.
 */
export function NoteComposer({ disabled, onSubmit }: NoteComposerProps) {
  const [value, setValueState] = useState(() => readDraft());
  const field = useRef<HTMLTextAreaElement>(null);
  // Height cap comes from the CSS `max-h-40` alone, so native and JS sizing agree.
  useAutoGrow(field, value);

  const setValue = (next: string) => {
    setValueState(next);
    writeDraft(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.currentTarget.blur();
      return;
    }
    // Never submit mid-IME composition (incl. WebKit's keyCode 229 commit).
    if (e.key !== "Enter" || e.shiftKey || isImeComposing(e.nativeEvent)) return;
    e.preventDefault();
    // Only blanks: nothing to add, so clear them instead of leaving invisible text behind.
    if (!value.trim()) {
      if (value) setValue("");
      return;
    }
    // Clear (and forget the draft) only once the note is really in the list.
    if (onSubmit(value)) setValue("");
  };

  return (
    <div className="group/composer @container rounded-md border border-border bg-elevated transition-[border-color,box-shadow] duration-200 ease-out-quint focus-within:border-border-strong focus-within:shadow-halo has-disabled:opacity-50">
      <label htmlFor={INBOX_COMPOSER_ID} className="sr-only">
        {t("New note")}
      </label>
      <textarea
        ref={field}
        id={INBOX_COMPOSER_ID}
        rows={1}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t("Jot a note…")}
        className="block max-h-40 w-full resize-none bg-transparent px-2.5 py-2 text-ui text-fg [field-sizing:content] outline-none placeholder:text-fg-subtle focus-visible:outline-none disabled:cursor-not-allowed"
      />
      {/* Hint unfolds only while typing, so the idle composer stays a single quiet line.
          Always one line: in a narrow sidebar only "Enter ekle" remains. */}
      <div className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-200 ease-out-quint group-focus-within/composer:grid-rows-[1fr] group-focus-within/composer:opacity-100">
        <div className="overflow-hidden" aria-hidden>
          <div className="flex items-center gap-1 overflow-hidden px-2.5 pb-2 text-2xs whitespace-nowrap text-fg-subtle">
            <Kbd keys="enter" className="shrink-0" />
            <span className="shrink-0">{t("add")}</span>
            <span className="flex min-w-0 items-center gap-1 @max-[15rem]:hidden">
              <span className="px-0.5">·</span>
              <Kbd keys="shift+enter" className="shrink-0" />
              <span className="truncate">{t("new line")}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
