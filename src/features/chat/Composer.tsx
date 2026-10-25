import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { ArrowUp, ChevronDown } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { Kbd } from "@/shared/ui/Kbd";
import { canSendMessage, getComposerKeyAction } from "./composerKeys";

/** Agents arrive in Phase 2; until then the composer is typeable but cannot send. */
const AGENT_READY = false;
const NOTICE_MS = 2600;

/** Message input: auto-growing field, agent chip, send button and a shortcut hint row. */
export function Composer() {
  const id = useId();
  const hintId = `${id}-hint`;
  const [value, setValue] = useState("");
  const [notice, setNotice] = useState(false);
  const canSend = canSendMessage(value, AGENT_READY);
  const hasText = value.trim().length > 0;

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(false), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const submit = () => {
    if (!canSend) {
      // Say why nothing happened instead of silently swallowing the keystroke.
      if (hasText) setNotice(true);
      return;
    }
    setValue("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const action = getComposerKeyAction({
      key: event.key,
      shiftKey: event.shiftKey,
      isComposing: event.nativeEvent.isComposing,
    });
    if (action === "submit") {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="w-full">
      <div className="rounded-xl border border-border bg-surface transition-[border-color,box-shadow] duration-base ease-out-quint focus-within:border-border-strong focus-within:shadow-halo">
        <label htmlFor={id} className="sr-only">
          Mesaj
        </label>
        <textarea
          id={id}
          rows={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          aria-describedby={hintId}
          spellCheck={false}
          placeholder="Bir görev tarif et ya da soru sor…"
          className="block max-h-[40vh] min-h-14 w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-ui text-fg [field-sizing:content] outline-none placeholder:text-fg-subtle focus-visible:outline-none"
        />
        <div className="flex items-center justify-between gap-2 px-2.5 pt-1 pb-2.5">
          <button
            type="button"
            disabled
            title="Agent bağlantısı yakında"
            className="inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs text-fg-muted disabled:cursor-not-allowed"
          >
            {/* Hollow dot: no agent connected yet. */}
            <span className="size-1.5 rounded-full border border-fg-subtle" aria-hidden />
            Agent seçilmedi
            <ChevronDown size={12} strokeWidth={1.75} className="text-fg-subtle" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Gönder"
            title={canSend ? "Gönder" : "Gönder (agent bağlantısı yakında)"}
            disabled={!canSend}
            onClick={submit}
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-lg border transition-[background-color,color,border-color] duration-base ease-out-quint disabled:cursor-not-allowed",
              canSend
                ? "border-transparent bg-accent text-accent-fg hover:bg-fg"
                : hasText
                  ? "border-border-strong bg-elevated text-fg-muted"
                  : "border-border bg-elevated text-fg-subtle",
            )}
          >
            <ArrowUp size={15} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
      <p
        id={hintId}
        aria-live="polite"
        className="mt-2.5 flex h-4.5 items-center justify-center gap-1.5 text-2xs text-fg-subtle"
      >
        {notice ? (
          <span className="text-fg-muted">
            Henüz bağlı agent yok; mesaj gönderme Faz 2&apos;de açılıyor.
          </span>
        ) : (
          <>
            <Kbd keys="enter" />
            <span>gönder</span>
            <span aria-hidden className="px-1 text-fg-subtle">
              ·
            </span>
            <Kbd keys="shift+enter" />
            <span>yeni satır</span>
          </>
        )}
      </p>
    </div>
  );
}
