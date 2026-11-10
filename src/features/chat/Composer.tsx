import {
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import type { TurnState } from "@/features/agents/reducer";
import type { AcpCommand } from "@/features/agents/types";
import { useAutoGrow } from "@/shared/lib/autoGrow";
import { useSettingsStore } from "@/features/settings/store";
import { cn } from "@/shared/ui/cn";
import { AttachmentCard } from "./AttachmentCard";
import type { Attachment } from "./attachments";
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
import { absolutePath, loadFileIndex } from "@/features/files/fileIndex";
import { searchFiles, type FileHit, type IndexedFile } from "@/features/files/fileSearch";
import { mentionOptionId, mentionToken, removeMention } from "./mention";
import { MentionPopover } from "./MentionPopover";
import { matchesAction } from "@/features/keymap/keymap";
import { SendButton } from "./SendButton";
import { t } from "@/shared/i18n";

export interface ComposerHandle {
  /** Replaces the draft (e.g. from a suggestion) and focuses the field. */
  fill: (text: string) => void;
  /** Adds a block after the draft (a blank line between) and focuses the field. */
  append: (text: string) => void;
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
  /** Folder whose files "@" lists; no folder, no mentions. */
  mentionRoot?: string | null;
  /** A file picked from the "@" list (absolute path), to attach. */
  onMention?: (path: string) => void;
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
  mentionRoot = null,
  onMention,
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
    append: (text: string) => {
      const draft = fieldRef.current?.value ?? value;
      replaceDraft(draft.trim() ? `${draft.replace(/\s+$/, "")}\n\n${text}\n` : `${text}\n`);
    },
    focus: () => fieldRef.current?.focus(),
  }));

  // "@name": the folder's files, attached on pick.
  const mentionListId = `${id}-mention`;
  const [mentionDismissed, setMentionDismissed] = useState<number | null>(null);
  const [files, setFiles] = useState<IndexedFile[] | null>(null);
  const token = mentionRoot && onMention ? mentionToken(value, caret) : null;
  const mentionOpen = token !== null && token.start !== mentionDismissed;
  useEffect(() => {
    if (!mentionOpen || !mentionRoot) return;
    let alive = true;
    void loadFileIndex(mentionRoot, (fresh) => alive && setFiles(fresh)).then(
      (list) => alive && setFiles(list),
    );
    return () => {
      alive = false;
    };
  }, [mentionOpen, mentionRoot]);
  const mentionQuery = mentionOpen ? token.query : null;
  const mentionHits = useMemo(
    () => (mentionQuery !== null && files ? searchFiles(mentionQuery, files, 8) : []),
    [mentionQuery, files],
  );

  const pickMention = (hit: FileHit) => {
    if (!token || !mentionRoot) return;
    const next = removeMention(value, token, caret);
    setValue(next.text);
    setCaret(next.caret);
    onMention?.(absolutePath(mentionRoot, hit.path));
    requestAnimationFrame(() => {
      const el = fieldRef.current;
      el?.focus();
      el?.setSelectionRange(next.caret, next.caret);
    });
  };

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
    if (mentionOpen) {
      const last = mentionHits.length - 1;
      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && last >= 0) {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((i) => (i + step > last ? 0 : i + step < 0 ? last : i + step));
        return;
      }
      if (
        (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) &&
        last >= 0 &&
        !event.nativeEvent.isComposing
      ) {
        event.preventDefault();
        pickMention(mentionHits[Math.min(active, last)]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionDismissed(token.start);
        return;
      }
    }
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
    if (event.key === "Escape" && slashOpen) {
      event.preventDefault();
      setSlashDismissed(true);
      return;
    }
    if (running && matchesAction(event, "chat.stop")) {
      event.preventDefault();
      onStop();
      return;
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
      {mentionOpen && (
        <MentionPopover
          id={mentionListId}
          hits={mentionHits}
          active={Math.min(active, Math.max(0, mentionHits.length - 1))}
          loading={files === null}
          onHover={setActive}
          onPick={pickMention}
        />
      )}
      {slashOpen && !mentionOpen && (
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
          {t("Message")}
        </label>
        {attachments.length > 0 && (
          <ul aria-label={t("Attachments")} className="flex flex-wrap gap-2 px-3 pt-3">
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
          aria-expanded={slashOpen || mentionOpen}
          aria-controls={mentionOpen ? mentionListId : slashOpen ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            mentionOpen && mentionHits.length > 0
              ? mentionOptionId(mentionListId, Math.min(active, mentionHits.length - 1))
              : slashOpen && items.length > 0
                ? slashOptionId(listId, activeIndex)
                : undefined
          }
          spellCheck={false}
          placeholder={
            running
              ? t("Type a follow-up; it is sent when the turn ends…")
              : hero
                ? t("Ask for anything…")
                : t("Reply or give a new task…")
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
