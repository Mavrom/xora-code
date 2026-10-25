import { useState, type KeyboardEvent } from "react";
import { Kbd } from "./Kbd";

/** Lets the activity bar focus the composer for quick capture. */
export const INBOX_COMPOSER_ID = "inbox-composer";

interface NoteComposerProps {
  disabled: boolean;
  onSubmit: (text: string) => void;
}

/** Quick-capture input: Enter adds, Shift+Enter breaks the line, Esc steps away. */
export function NoteComposer({ disabled, onSubmit }: NoteComposerProps) {
  const [value, setValue] = useState("");

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.currentTarget.blur();
      return;
    }
    // Never submit mid-IME composition.
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit(value);
    setValue("");
  };

  return (
    <div className="group/composer rounded-md border border-border bg-elevated transition-[border-color,box-shadow] duration-200 ease-out-quint focus-within:border-border-strong focus-within:shadow-halo has-disabled:opacity-50">
      <label htmlFor={INBOX_COMPOSER_ID} className="sr-only">
        Yeni not
      </label>
      <textarea
        id={INBOX_COMPOSER_ID}
        rows={1}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Bir not bırak…"
        className="block max-h-40 w-full resize-none bg-transparent px-2.5 py-2 text-[13px] leading-5 text-fg [field-sizing:content] outline-none placeholder:text-fg-subtle focus-visible:outline-none disabled:cursor-not-allowed"
      />
      {/* Hint unfolds only while typing, so the idle composer stays a single quiet line. */}
      <div className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-200 ease-out-quint group-focus-within/composer:grid-rows-[1fr] group-focus-within/composer:opacity-100">
        <div className="overflow-hidden" aria-hidden>
          <div className="flex items-center gap-1 px-2.5 pb-2 text-[10.5px] text-fg-subtle">
            <Kbd>Enter</Kbd> ekle
            <span className="px-0.5">·</span>
            <Kbd>Shift</Kbd>
            <Kbd>Enter</Kbd> yeni satır
          </div>
        </div>
      </div>
    </div>
  );
}
