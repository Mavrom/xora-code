import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { ChevronRight, Inbox, RotateCw } from "lucide-react";
import { EmptyState } from "@/shared/ui/EmptyState";
import { PanelHeader } from "@/shared/ui/PanelHeader";
import { cn } from "@/shared/ui/cn";
import type { Note } from "@/shared/lib/ipc";
import { NoteComposer } from "./NoteComposer";
import { NoteItem } from "./NoteItem";
import { noteRows } from "./noteRows";
import { sortNotes } from "./sortNotes";
import { useInboxStore } from "./store";

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

  const { open, done } = useMemo(() => {
    const sorted = sortNotes(notes);
    return { open: sorted.filter((n) => !n.done), done: sorted.filter((n) => n.done) };
  }, [notes]);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Inbox"
        actions={
          status === "ready" && open.length > 0 ? (
            <span
              className="px-2.5 text-[11px] text-fg-subtle tabular-nums"
              aria-label={`${open.length} açık not`}
            >
              {open.length}
            </span>
          ) : undefined
        }
      />
      <div className="shrink-0 px-2 pb-2">
        <NoteComposer disabled={status !== "ready"} onSubmit={add} />
        {status === "ready" && error && (
          <p role="status" className="mt-2 px-1 text-[11px] leading-snug text-danger select-text">
            Kaydedilemedi: {error}. Bir sonraki değişiklikte yeniden denenecek.
          </p>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {status === "ready" ? (
          notes.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Inbox boş"
              description="Aklına geleni buraya bırak; sonra dönersin."
            />
          ) : (
            <NoteLists open={open} done={done} />
          )
        ) : status === "error" ? (
          <LoadError message={error ?? "Bilinmeyen hata"} />
        ) : (
          <LoadingRows />
        )}
      </div>
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
        <div role="list" aria-label="Notlar" className="flex flex-col gap-px">
          {open.map((note) => (
            <NoteItem key={note.id} note={note} now={now} />
          ))}
        </div>
      ) : (
        <p className="px-2.5 py-3 text-[12px] text-fg-subtle">Açık not kalmadı.</p>
      )}

      {done.length > 0 && (
        <section className="mt-3">
          <button
            type="button"
            aria-expanded={showDone}
            aria-controls="inbox-done"
            onClick={() => setShowDone((v) => !v)}
            className="flex h-7 w-full items-center gap-1 rounded-sm px-1.5 text-[11px] font-medium tracking-wide text-fg-subtle uppercase transition-colors duration-150 hover:text-fg-muted"
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
            Tamamlananlar
            <span className="tabular-nums">({done.length})</span>
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
              <div role="list" aria-label="Tamamlanan notlar" className="flex flex-col gap-px">
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
        Notlar yüklenemedi: {message}
      </p>
      <button
        type="button"
        onClick={() => void load()}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-strong bg-elevated px-3 text-[12px] font-medium text-fg transition-colors duration-150 hover:bg-hover"
      >
        <RotateCw size={13} strokeWidth={1.75} aria-hidden />
        Tekrar dene
      </button>
    </div>
  );
}

/** Three calm placeholder rows with staggered widths. */
function LoadingRows() {
  return (
    <div aria-busy="true" aria-label="Notlar yükleniyor" className="flex flex-col gap-1 px-1.5">
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
