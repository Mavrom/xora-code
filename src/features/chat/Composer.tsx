import { useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown } from "lucide-react";
import { IconButton } from "@/shared/ui/IconButton";

const LINE_HEIGHT = 20;
const MAX_LINES = 8;

/** Message input. Agents arrive in Phase 2, so it renders finished but disabled. */
export function Composer() {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const disabled = true;

  // Grow with the content up to MAX_LINES, then scroll.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, LINE_HEIGHT * MAX_LINES)}px`;
  }, [value]);

  return (
    <div className="rounded-lg border border-border bg-elevated transition-colors duration-150 focus-within:border-border-strong">
      <label htmlFor="composer-input" className="sr-only">
        Mesaj
      </label>
      <textarea
        id="composer-input"
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        placeholder="Agent'a bir şey sor…"
        style={{ lineHeight: `${LINE_HEIGHT}px` }}
        className="block w-full resize-none bg-transparent px-3.5 pt-3 text-[13px] text-fg outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed"
      />
      <div className="flex items-center justify-between px-2 pt-1 pb-2">
        <button
          type="button"
          disabled
          className="inline-flex h-6 items-center gap-1.5 rounded-sm border border-border px-2 text-[11px] font-medium text-fg-subtle disabled:cursor-not-allowed"
        >
          <span className="size-1.5 rounded-full bg-fg-subtle" aria-hidden />
          Agent seçilmedi
          <ChevronDown size={12} strokeWidth={1.75} aria-hidden />
        </button>
        <IconButton icon={ArrowUp} label="Gönder" variant="solid" disabled={disabled || !value} />
      </div>
    </div>
  );
}
