import {
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { ArrowUp, Square } from "lucide-react";
import type { TurnState } from "@/features/agents/reducer";
import type { AcpCommand } from "@/features/agents/types";
import { useAutoGrow } from "@/shared/lib/autoGrow";
import { cn } from "@/shared/ui/cn";
import { getComposerKeyAction } from "./composerKeys";
import {
  applySlash,
  filterSlash,
  slashOptionId,
  slashQuery,
  xoraCommandOf,
  type SlashItem,
  type XoraCommandName,
} from "./slash";
import { SlashPopover } from "./SlashPopover";

export interface ComposerHandle {
  /** Replaces the draft (e.g. from a suggestion) and focuses the field. */
  fill: (text: string) => void;
  focus: () => void;
}

interface ComposerProps {
  ref?: Ref<ComposerHandle>;
  /** `hero`: the big centred field of an empty chat; `docked`: pinned under the transcript. */
  variant: "hero" | "docked";
  /** Why sending is not possible right now, or null when it is. */
  blockedReason: string | null;
  turn: TurnState;
  commands: AcpCommand[];
  /** Chips on the left of the bottom bar (mode, extras). */
  toolbar?: ReactNode;
  /** Quiet meter left of the send button (context usage). */
  meter?: ReactNode;
  onSubmit: (text: string) => void;
  onStop: () => void;
  onXoraCommand: (name: XoraCommandName) => void;
  /** Called with a short message when a send is refused (shown by the parent). */
  onRefused: (reason: string) => void;
}

/**
 * Message input: auto-growing glass field with a slash-command popover, a chip bar and a
 * send button that turns into Stop while a turn runs (Esc stops too).
 */
export function Composer({
  ref,
  variant,
  blockedReason,
  turn,
  commands,
  toolbar,
  meter,
  onSubmit,
  onStop,
  onXoraCommand,
  onRefused,
}: ComposerProps) {
  const id = useId();
  const listId = `${id}-slash`;
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [slashDismissed, setSlashDismissed] = useState(false);
  const hero = variant === "hero";
  const running = turn !== "idle";
  const hasText = value.trim().length > 0;
  const canSend = hasText && blockedReason === null;

  useAutoGrow(fieldRef, value);

  useImperativeHandle(ref, () => ({
    fill: (text) => {
      setValue(text);
      requestAnimationFrame(() => {
        const el = fieldRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(text.length, text.length);
      });
    },
    focus: () => fieldRef.current?.focus(),
  }));

  const query = slashDismissed ? null : slashQuery(value, caret);
  const items = useMemo(
    () => (query === null ? [] : filterSlash(commands, query)),
    [commands, query],
  );
  const slashOpen = query !== null;
  const activeIndex = Math.min(active, Math.max(0, items.length - 1));

  const pickSlash = (item: SlashItem) => {
    if (item.group === "xora") {
      setValue("");
      onXoraCommand(item.name as XoraCommandName);
      return;
    }
    const next = applySlash(value, item.name);
    setValue(next);
    setSlashDismissed(true);
    requestAnimationFrame(() => {
      const el = fieldRef.current;
      el?.focus();
      el?.setSelectionRange(next.length, next.length);
    });
  };

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    const xora = xoraCommandOf(text);
    if (xora) {
      setValue("");
      onXoraCommand(xora);
      return;
    }
    if (!canSend) {
      onRefused(blockedReason ?? "");
      return;
    }
    onSubmit(text);
    setValue("");
    setSlashDismissed(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOpen && items.length > 0) {
      const last = items.length - 1;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((i) => (i + step > last ? 0 : i + step < 0 ? last : i + step));
        return;
      }
      if (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) {
        if (!event.nativeEvent.isComposing) {
          event.preventDefault();
          pickSlash(items[activeIndex]);
          return;
        }
      }
    }
    if (event.key === "Escape") {
      if (slashOpen) {
        event.preventDefault();
        setSlashDismissed(true);
        return;
      }
      if (running) {
        event.preventDefault();
        onStop();
        return;
      }
    }
    const action = getComposerKeyAction({
      key: event.key,
      shiftKey: event.shiftKey,
      isComposing: event.nativeEvent.isComposing,
      keyCode: event.nativeEvent.keyCode,
    });
    if (action === "submit") {
      event.preventDefault();
      submit();
    }
  };

  const syncCaret = () => setCaret(fieldRef.current?.selectionStart ?? 0);

  return (
    <div className="relative w-full">
      {slashOpen && (
        <SlashPopover
          id={listId}
          items={items}
          active={activeIndex}
          onHover={setActive}
          onPick={pickSlash}
        />
      )}
      <div
        className={cn(
          "rounded-2xl border border-glass-border bg-glass-strong backdrop-blur-xl",
          "shadow-[inset_0_1px_0_var(--color-glass-border)] transition-[border-color,box-shadow] duration-base ease-out-quint",
          "focus-within:border-border-strong focus-within:shadow-halo",
          hero && "shadow-2xl shadow-black/40",
        )}
      >
        <label htmlFor={id} className="sr-only">
          Mesaj
        </label>
        <textarea
          ref={fieldRef}
          id={id}
          rows={1}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setCaret(event.target.selectionStart);
            // A fresh query starts at the top of the list.
            setActive(0);
            if (!event.target.value.startsWith("/")) setSlashDismissed(false);
          }}
          onKeyDown={onKeyDown}
          onKeyUp={syncCaret}
          onClick={syncCaret}
          role="combobox"
          aria-expanded={slashOpen}
          aria-controls={slashOpen ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            slashOpen && items.length > 0 ? slashOptionId(listId, activeIndex) : undefined
          }
          spellCheck={false}
          placeholder={
            running
              ? "Devam etmesi için yaz; tur bitince gönderilir…"
              : hero
                ? "Bir şey iste…"
                : "Yanıtla ya da yeni bir görev ver…"
          }
          className={cn(
            "block max-h-[40vh] w-full resize-none bg-transparent text-fg [field-sizing:content] outline-none placeholder:text-fg-subtle focus-visible:outline-none",
            hero
              ? "min-h-22 px-5 pt-4.5 pb-2 text-[15px] leading-6"
              : "min-h-11 px-4 pt-3 pb-1 text-ui",
          )}
        />
        <div className={cn("flex items-center gap-2 pt-1", hero ? "px-3 pb-3" : "px-2.5 pb-2.5")}>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">{toolbar}</div>
          {meter}
          <SendButton
            running={running}
            cancelling={turn === "cancelling"}
            canSend={canSend}
            hasText={hasText}
            onSend={submit}
            onStop={onStop}
          />
        </div>
      </div>
    </div>
  );
}

interface SendButtonProps {
  running: boolean;
  cancelling: boolean;
  canSend: boolean;
  hasText: boolean;
  onSend: () => void;
  onStop: () => void;
}

/** Send while idle; a square Stop while the agent works (text typed then still queues on Enter). */
function SendButton({ running, cancelling, canSend, hasText, onSend, onStop }: SendButtonProps) {
  const stop = running && !hasText;
  const label = cancelling
    ? "Durduruluyor…"
    : stop
      ? "Durdur (Esc)"
      : running
        ? "Sıraya ekle"
        : "Gönder";
  const enabled = stop ? !cancelling : canSend;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={!enabled}
      onClick={stop ? onStop : onSend}
      className={cn(
        "relative grid size-8 shrink-0 place-items-center rounded-xl border transition-[background-color,color,border-color] duration-base ease-out-quint disabled:cursor-not-allowed",
        enabled
          ? "border-transparent bg-accent text-accent-fg hover:bg-fg"
          : hasText
            ? "border-border-strong bg-elevated text-fg-muted"
            : "border-glass-border bg-glass text-fg-subtle",
      )}
    >
      {/* Both icons stay mounted and cross-fade, so the swap never jumps. */}
      <ArrowUp
        size={16}
        strokeWidth={2}
        aria-hidden
        className={cn(
          "col-start-1 row-start-1 transition-[opacity,scale] duration-fast ease-out-quint",
          stop ? "scale-75 opacity-0" : "scale-100 opacity-100",
        )}
      />
      <Square
        size={11}
        strokeWidth={0}
        fill="currentColor"
        aria-hidden
        className={cn(
          "col-start-1 row-start-1 transition-[opacity,scale] duration-fast ease-out-quint",
          stop ? "scale-100 opacity-100" : "scale-75 opacity-0",
          cancelling && "animate-pulse",
        )}
      />
    </button>
  );
}
