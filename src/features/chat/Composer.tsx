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
import { ArrowUp, FileText, Folder, Square, X } from "lucide-react";
import type { TurnState } from "@/features/agents/reducer";
import type { AcpCommand } from "@/features/agents/types";
import { useAutoGrow } from "@/shared/lib/autoGrow";
import { useSettingsStore } from "@/features/settings/store";
import { cn } from "@/shared/ui/cn";
import { dataUrl, type Attachment } from "./attachments";
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
  /** Pictures and files going with the message, shown as cards above the field. */
  attachments?: readonly Attachment[];
  onRemoveAttachment?: (id: string) => void;
  /** Pictures pasted into the field (Ctrl+V of a screenshot). */
  onPasteImages?: (files: File[]) => void;
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
  attachments = [],
  onRemoveAttachment,
  onPasteImages,
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
  // A picture alone is a message too.
  const hasContent = hasText || attachments.length > 0;
  const canSend = hasContent && blockedReason === null;

  useAutoGrow(fieldRef, value);

  const replaceDraft = (text: string) => {
    setValue(text);
    requestAnimationFrame(() => {
      const el = fieldRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(text.length, text.length);
    });
  };

  useImperativeHandle(ref, () => ({
    fill: replaceDraft,
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
    if (!text && attachments.length === 0) return;
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
    const action = getComposerKeyAction(
      {
        key: event.key,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        isComposing: event.nativeEvent.isComposing,
        keyCode: event.nativeEvent.keyCode,
      },
      useSettingsStore.getState().settings.general.sendKey,
    );
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
          "rounded-xl border border-glass-border bg-[rgb(26_26_26/0.78)] backdrop-blur-xl",
          "shadow-[inset_0_1px_0_var(--color-glass-border)] transition-[border-color,box-shadow] duration-base ease-out-quint",
          "focus-within:border-border-strong focus-within:shadow-halo",
          hero && "shadow-2xl shadow-black/40",
        )}
      >
        <label htmlFor={id} className="sr-only">
          Mesaj
        </label>
        {attachments.length > 0 && (
          <ul aria-label="Ekler" className="flex flex-wrap gap-2 px-3 pt-3">
            {attachments.map((a) => (
              <li key={a.id}>
                <AttachmentCard attachment={a} onRemove={onRemoveAttachment} />
              </li>
            ))}
          </ul>
        )}
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
          onPaste={(event) => {
            const images = [...event.clipboardData.files].filter((f) =>
              f.type.startsWith("image/"),
            );
            if (images.length === 0 || !onPasteImages) return;
            event.preventDefault();
            onPasteImages(images);
          }}
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
              ? "min-h-16 px-4 pt-4 pb-1 text-[14px] leading-6"
              : "min-h-11 px-4 pt-3 pb-1 text-ui",
          )}
        />
        <div className="flex items-center gap-2 px-2 pt-1 pb-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">{toolbar}</div>
          {meter}
          <SendButton
            running={running}
            cancelling={turn === "cancelling"}
            canSend={canSend}
            hasText={hasContent}
            onSend={submit}
            onStop={onStop}
          />
        </div>
      </div>
    </div>
  );
}

/** One attachment above the field: a thumbnail for pictures, a name card for the rest. */
function AttachmentCard({
  attachment: a,
  onRemove,
}: {
  attachment: Attachment;
  onRemove?: (id: string) => void;
}) {
  const remove = onRemove && (
    <button
      type="button"
      aria-label={`${a.name} ekini kaldır`}
      title="Kaldır"
      onClick={() => onRemove(a.id)}
      className="absolute -top-1.5 -right-1.5 grid size-4.5 place-items-center rounded-full border border-white/10 bg-[#1c1c1e] text-fg-muted opacity-0 shadow-md transition-[opacity,color] duration-fast group-hover:opacity-100 group-focus-within:opacity-100 hover:text-fg"
    >
      <X size={10} strokeWidth={2.25} aria-hidden />
    </button>
  );
  if (a.kind === "image" && a.data && a.mimeType) {
    return (
      <span className="group relative block" title={a.name}>
        <img
          src={dataUrl(a.mimeType, a.data)}
          alt={a.name}
          className="size-14 rounded-lg border border-white/10 object-cover"
        />
        {remove}
      </span>
    );
  }
  const Icon = a.kind === "folder" ? Folder : FileText;
  return (
    <span
      title={a.path ?? a.name}
      className="group relative flex h-9 max-w-56 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] pr-3 pl-2.5 text-xs text-fg-muted"
    >
      <Icon size={14} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-subtle" />
      <span className="truncate">{a.name}</span>
      {remove}
    </span>
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
        "relative grid size-7 shrink-0 place-items-center rounded-full bg-fg text-bg transition-[opacity,background-color] duration-base ease-out-quint disabled:cursor-not-allowed",
        enabled ? "hover:bg-white" : "opacity-55",
      )}
    >
      {/* Both icons stay mounted and cross-fade, so the swap never jumps. */}
      <ArrowUp
        size={15}
        strokeWidth={2.25}
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
