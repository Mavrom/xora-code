import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, Pin, PinOff, RotateCcw, Trash2 } from "lucide-react";
import type { Note } from "@/shared/lib/ipc";
import { IconButton } from "@/shared/ui/IconButton";
import { cn } from "@/shared/ui/cn";
import { relativeTime } from "./relativeTime";
import { noteRows } from "./noteRows";
import { useInboxStore } from "./store";

const fullDate = new Intl.DateTimeFormat("tr", { dateStyle: "long", timeStyle: "short" });

interface NoteItemProps {
  note: Note;
  /** Shared clock so every row's relative time ticks together. */
  now: number;
}

export function NoteItem({ note, now }: NoteItemProps) {
  const update = useInboxStore((s) => s.update);
  const togglePin = useInboxStore((s) => s.togglePin);
  const toggleDone = useInboxStore((s) => s.toggleDone);
  const remove = useInboxStore((s) => s.remove);

  const rowRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);

  // Track whether the 6-line clamp is hiding text (also on width changes).
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setClamped(el.scrollHeight > el.clientHeight + 1));
    observer.observe(el);
    return () => observer.disconnect();
  }, [editing, note.text]);

  const expandable = clamped || expanded;

  /**
   * Runs an action that may move or remove this row, then puts focus back on
   * it (or on its neighbour) so keyboard users never lose their place.
   */
  const keepFocus = (action: () => void) => {
    const row = rowRef.current;
    const scope = row?.closest("[data-inbox-list]");
    if (!row || !scope) return action();
    const rows = noteRows(scope);
    const index = rows.indexOf(row);
    const fallback = rows[index + 1] ?? rows[index - 1];
    action();
    requestAnimationFrame(() => {
      const same = scope.querySelector<HTMLElement>(`[data-note-id="${note.id}"]`);
      // Last row gone: park focus on the panel so Ctrl+Z (undo) still reaches it.
      const panel = scope.closest<HTMLElement>("[data-inbox-panel]");
      (same && !same.closest("[inert]") ? same : (fallback ?? panel))?.focus();
    });
  };

  const onRowKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return;
    // A held key must not fire again and again (e.g. delete a whole list).
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    if (key === "enter") setEditing(true);
    else if (key === "p" && !note.done) keepFocus(() => togglePin(note.id));
    else if (key === "e") keepFocus(() => toggleDone(note.id));
    else if (key === "delete") keepFocus(() => remove(note.id));
    else return;
    e.preventDefault();
  };

  const finishEdit = (text: string | null, refocus: boolean) => {
    if (text !== null) update(note.id, text);
    setEditing(false);
    if (refocus) requestAnimationFrame(() => rowRef.current?.focus());
  };

  return (
    <div
      ref={rowRef}
      role="listitem"
      tabIndex={0}
      aria-keyshortcuts="Enter P E Delete"
      data-note-row
      data-note-id={note.id}
      onKeyDown={onRowKeyDown}
      onDoubleClick={() => setEditing(true)}
      className={cn(
        "group relative rounded-md px-2.5 py-2 outline-none",
        "transition-[background-color,opacity,translate] duration-200 ease-out-quint starting:translate-y-1 starting:opacity-0",
        editing
          ? "bg-elevated ring-1 ring-border-strong"
          : "hover:bg-hover focus-visible:bg-hover focus-visible:ring-1 focus-visible:ring-border-strong",
      )}
    >
      {editing ? (
        <EditArea initial={note.text} onDone={finishEdit} />
      ) : (
        <p
          ref={textRef}
          onClick={expandable ? () => setExpanded((v) => !v) : undefined}
          className={cn(
            "pr-1 text-[13px] leading-5 break-words whitespace-pre-wrap transition-colors duration-200",
            !expanded && "line-clamp-6",
            note.done ? "text-fg-subtle line-through decoration-fg-subtle" : "text-fg",
          )}
        >
          {note.text}
        </p>
      )}

      {/* Meta line; the action strip sits at its end in normal flow, so it can
          never cover the time or "devamı" and wraps below them in a narrow panel. */}
      <div className="mt-1 flex min-h-4 flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-fg-subtle">
        {note.pinned && !note.done && (
          <Pin
            size={11}
            strokeWidth={2}
            role="img"
            aria-label="Sabit"
            className="shrink-0 text-fg-muted"
          />
        )}
        <time
          dateTime={new Date(note.createdAt).toISOString()}
          title={fullDate.format(note.createdAt)}
          className="tabular-nums"
        >
          {relativeTime(note.createdAt, now)}
        </time>
        {expandable && !editing && (
          <>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-sm text-fg-subtle transition-colors duration-150 hover:text-fg-muted"
            >
              {expanded ? "daralt" : "devamı"}
            </button>
          </>
        )}
        {!editing && (
          <div
            className={cn(
              // -my-1: the 24px buttons fit the 16px line without growing the row.
              "-my-1 -mr-1 ml-auto flex items-center gap-0.5",
              "translate-x-1 opacity-0 transition-[opacity,translate] duration-150 ease-out-quint",
              "group-hover:translate-x-0 group-hover:opacity-100",
              // Keyboard focus on the row or on an action keeps them visible.
              "group-focus-visible:translate-x-0 group-focus-visible:opacity-100 group-has-[:focus-visible]:translate-x-0 group-has-[:focus-visible]:opacity-100",
            )}
          >
            {!note.done && (
              <IconButton
                size="sm"
                icon={note.pinned ? PinOff : Pin}
                label={note.pinned ? "Sabitlemeyi kaldır (P)" : "Sabitle (P)"}
                onClick={() => togglePin(note.id)}
              />
            )}
            <IconButton
              size="sm"
              icon={note.done ? RotateCcw : Check}
              label={note.done ? "Geri al (E)" : "Tamamla (E)"}
              onClick={() => toggleDone(note.id)}
            />
            <IconButton
              size="sm"
              icon={Trash2}
              label="Sil (Del)"
              onClick={() => keepFocus(() => remove(note.id))}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface EditAreaProps {
  initial: string;
  /** `null` text means cancelled; `refocus` returns focus to the row. */
  onDone: (text: string | null, refocus: boolean) => void;
}

function EditArea({ initial, onDone }: EditAreaProps) {
  const [draft, setDraft] = useState(initial);
  const finished = useRef(false);

  const finish = (text: string | null, refocus: boolean) => {
    if (finished.current) return;
    finished.current = true;
    onDone(text, refocus);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      finish(null, true);
    } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      finish(draft, true);
    }
  };

  return (
    <textarea
      autoFocus
      aria-label="Notu düzenle"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={(e) => e.currentTarget.setSelectionRange(draft.length, draft.length)}
      // Clicking away keeps the edit, like most note apps.
      onBlur={() => finish(draft, false)}
      className="block max-h-60 w-full resize-none bg-transparent text-[13px] leading-5 text-fg [field-sizing:content] outline-none focus-visible:outline-none"
    />
  );
}
