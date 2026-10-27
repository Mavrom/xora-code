import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { ChevronRight, Inbox, RotateCw } from "lucide-react";
import { EmptyState } from "@/shared/ui/EmptyState";
import { PanelHeader } from "@/shared/ui/PanelHeader";
import { cn } from "@/shared/ui/cn";
import type { Note } from "@/shared/lib/ipc";
import { NoteComposer } from "./NoteComposer";
import { NoteItem } from "./NoteItem";
import { noteRows } from "./noteRows";
import { saveErrorMessage, secondsUntil } from "./retryCountdown";
import { sortNotes } from "./sortNotes";
import { useInboxStore } from "./store";
import { useFlushOnClose } from "./useFlushOnClose";
import { t } from "@/shared/i18n";

/** How long the "note deleted" undo bar stays up. */
const UNDO_MS = 6_000;
const UNDO_FADE_MS = 200;

/** Re-renders once a minute so relative times stay honest. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function InboxPanel() {
  const notes = useInboxStore((s) => s.notes);
  const status = useInboxStore((s) => s.status);
  const error = useInboxStore((s) => s.error);
  const add = useInboxStore((s) => s.add);
  const removed = useInboxStore((s) => s.removed);
  const lastRemoved = removed[removed.length - 1] as Note | undefined;
  useFlushOnClose();

  const { open, done } = useMemo(() => {
    const sorted = sortNotes(notes);
    return { open: sorted.filter((n) => !n.done), done: sorted.filter((n) => n.done) };
  }, [notes]);

  // Ctrl+Z anywhere in the panel undoes the latest delete (again for the one
  // before it, and so on); text fields keep their own undo.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.repeat) return;
    if (e.key.toLowerCase() !== "z" || !lastRemoved) return;
    const target = e.target as HTMLElement;
    if (target.closest("textarea, input, [contenteditable='true']")) return;
    e.preventDefault();
    undoRemove(e.currentTarget);
  };

  return (
    <div
      data-inbox-panel
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="flex h-full flex-col outline-none"
    >
      <PanelHeader
        title={t("Inbox")}
        actions={
          status === "ready" && open.length > 0 ? (
            <span
              className="px-2.5 text-[11px] text-fg-subtle tabular-nums"
              aria-label={
                open.length === 1 ? t("1 open note") : t("{n} open notes", { n: open.length })
              }
            >
              {open.length}
            </span>
          ) : undefined
        }
      />
      <div className="shrink-0 px-1.5 pb-3">
        <NoteComposer disabled={status !== "ready"} onSubmit={add} />
        {status === "ready" && error && <SaveError error={error} />}
      </div>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {status === "ready" ? (
          notes.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={t("Inbox is empty")}
              description={t("Drop whatever comes to mind here and come back to it later.")}
            />
          ) : (
            <NoteLists open={open} done={done} />
          )
        ) : status === "error" ? (
          <LoadError message={error ?? t("Unknown error")} />
        ) : (
          <LoadingRows />
        )}
      </div>
      {/* Keyed by the newest removal so each delete restarts the timer. */}
      {lastRemoved && <UndoBar key={lastRemoved.id} count={removed.length} />}
    </div>
  );
}

/**
 * Current time for a countdown to `target`: ticks at most once per second,
 * only while the window is visible, and stops once the target is reached.
 */
function useCountdownNow(target: number | null) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (target === null) return;
    let id: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      clearInterval(id);
      id = undefined;
    };
    const tick = () => {
      const stamp = Date.now();
      setNow(stamp);
      if (secondsUntil(target, stamp) === 0) stop();
    };
    const sync = () => {
      stop();
      if (document.hidden) return;
      tick();
      if (secondsUntil(target, Date.now()) > 0) id = setInterval(tick, 1_000);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [target]);
  return now;
}

/** "Kaydedilemedi · 15 sn içinde tekrar denenecek", counting down calmly. */
function SaveError({ error }: { error: string }) {
  const nextRetryAt = useInboxStore((s) => s.nextRetryAt);
  const now = useCountdownNow(nextRetryAt);

  return (
    <div role="status" className="mt-2 px-1 text-[11px] leading-snug text-danger" title={error}>
      {/* Announced once; the ticking text is hidden from screen readers. */}
      <span className="sr-only">
        {t("Could not save: {error}. Retrying automatically.", { error })}
      </span>
      <span aria-hidden className="tabular-nums">
        {saveErrorMessage(nextRetryAt, now)}
      </span>
    </div>
  );
}

/** Restores the latest removed note and puts keyboard focus on it (or on the panel). */
function undoRemove(panel: HTMLElement | null) {
  const note = useInboxStore.getState().undoRemove();
  if (!note) return;
  requestAnimationFrame(() => {
    const row = panel?.querySelector<HTMLElement>(`[data-note-id="${note.id}"]`);
    (row && !row.closest("[inert]") ? row : panel)?.focus();
  });
}

/**
 * "Note deleted · Undo" for a few seconds; stays while hovered or focused.
 * `count` removals are waiting; each undo restores the newest one.
 */
function UndoBar({ count }: { count: number }) {
  const dismiss = useInboxStore((s) => s.dismissRemoved);
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setTimeout(() => setLeaving(true), UNDO_MS);
    return () => clearTimeout(id);
  }, [paused]);

  useEffect(() => {
    if (!leaving) return;
    const id = setTimeout(dismiss, UNDO_FADE_MS);
    return () => clearTimeout(id);
  }, [leaving, dismiss]);

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        "mx-1.5 mb-2 flex h-8 shrink-0 items-center justify-between gap-2 rounded-md border border-border bg-elevated pr-1 pl-2.5 text-[12px] text-fg-muted",
        "transition-[opacity,translate] duration-200 ease-out-quint starting:translate-y-1 starting:opacity-0",
        leaving && "translate-y-1 opacity-0",
      )}
    >
      <span>{count > 1 ? t("{n} notes deleted", { n: count }) : t("Note deleted")}</span>
      <button
        type="button"
        aria-keyshortcuts="Control+Z"
        title={t("Undo (Ctrl+Z)")}
        onClick={(e) => undoRemove(e.currentTarget.closest("[data-inbox-panel]"))}
        className="h-6 rounded-sm px-2 font-medium text-fg transition-colors duration-150 hover:bg-hover"
      >
        {t("Undo")}
      </button>
    </div>
  );
}

function NoteLists({ open, done }: { open: Note[]; done: Note[] }) {
  const now = useNow();
  const [showDone, setShowDone] = useState(false);

  // Up/Down walk through visible rows across both lists.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = noteRows(e.currentTarget);
    const index = rows.indexOf(document.activeElement as HTMLElement);
    if (index === -1) return;
    const next = rows[e.key === "ArrowDown" ? index + 1 : Math.max(index - 1, 0)];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  return (
    <div data-inbox-list onKeyDown={onKeyDown} className="px-1.5 pb-3">
      {open.length > 0 ? (
        <div role="list" aria-label={t("Notes")} className="flex flex-col gap-px">
          {open.map((note) => (
            <NoteItem key={note.id} note={note} now={now} />
          ))}
        </div>
      ) : (
        <p className="px-2.5 py-3 text-[12px] text-fg-subtle">{t("No open notes left.")}</p>
      )}

      {done.length > 0 && (
        <section aria-labelledby="inbox-done-heading" className="mt-3">
          <button
            id="inbox-done-heading"
            type="button"
            aria-expanded={showDone}
            aria-controls="inbox-done"
            onClick={() => setShowDone((v) => !v)}
            className="flex h-7 w-full min-w-0 items-center gap-1 rounded-sm px-1.5 text-2xs font-medium tracking-wide whitespace-nowrap text-fg-subtle uppercase transition-colors duration-150 hover:text-fg-muted"
          >
            <ChevronRight
              size={13}
              strokeWidth={1.75}
              aria-hidden
              className={cn(
                "shrink-0 transition-transform duration-200 ease-out-quint",
                showDone && "rotate-90",
              )}
            />
            <span className="min-w-0 truncate">{t("Done")}</span>
            <span className="shrink-0 tabular-nums">({done.length})</span>
          </button>
          {/* Collapses with grid rows (no height measuring); inert keeps hidden rows out of tab order. */}
          <div
            id="inbox-done"
            inert={!showDone}
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-300 ease-out-quint",
              showDone ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div role="list" aria-label={t("Done notes")} className="flex flex-col gap-px">
                {done.map((note) => (
                  <NoteItem key={note.id} note={note} now={now} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function LoadError({ message }: { message: string }) {
  const load = useInboxStore((s) => s.load);
  return (
    <div role="alert" className="flex flex-col items-start gap-3 px-4 py-3">
      <p className="text-[12px] leading-relaxed break-words text-danger select-text">
        {t("Could not load notes: {message}", { message })}
      </p>
      <button
        type="button"
        onClick={() => void load()}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-strong bg-elevated px-3 text-[12px] font-medium text-fg transition-colors duration-150 hover:bg-hover"
      >
        <RotateCw size={13} strokeWidth={1.75} aria-hidden />
        {t("Retry")}
      </button>
    </div>
  );
}

/** Three calm placeholder rows with staggered widths. */
function LoadingRows() {
  return (
    <div aria-busy="true" aria-label={t("Loading notes")} className="flex flex-col gap-1 px-1.5">
      {["w-11/12", "w-3/4", "w-5/6"].map((width, i) => (
        <div key={width} className="rounded-md px-2.5 py-2">
          <div
            className={cn("skeleton h-3 animate-skeleton rounded-sm", width)}
            style={{ animationDelay: `${i * 120}ms` }}
          />
          <div
            className="skeleton mt-2 h-2.5 w-10 animate-skeleton rounded-sm"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        </div>
      ))}
    </div>
  );
}
