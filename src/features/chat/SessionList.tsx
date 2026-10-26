import { shortTitle } from "./sessionTitle";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  MessagesSquare,
  MessageSquare,
  RotateCcw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useUiStore } from "@/app/uiStore";
import type { SessionListEntry } from "@/features/agents/sessionList";
import { selectProjectGroups, useAgentStore } from "@/features/agents/store";
import { relativeTime } from "@/features/inbox/relativeTime";
import { useWorkspaceStore } from "@/features/workspace/store";
import {
  selectWorktrees,
  useWorktreeStore,
  worktreeName,
  worktreeOf,
  type Worktree,
} from "@/features/git/worktrees";
import { cn } from "@/shared/ui/cn";
import { ContextMenu } from "@/shared/ui/ContextMenu";
import { SEPARATOR } from "@/shared/ui/menuModel";
import { AgentGlyph } from "./AgentGlyph";
import { Collapse } from "./Disclosure";
import { emptySessionKey, flatSessions, groupByDay, visibleGroups } from "./sessionListView";

/**
 * Conversation history for the sidebar: one newest-first list (or one project's, from the
 * project picker) under quiet day headings, with the archive folded away at the bottom.
 * Self-contained: reads the agent store and refreshes the agents' session lists whenever
 * the workspace changes or a turn finishes.
 */
export function SessionList() {
  const root = useWorkspaceStore((s) => s.root);
  const groups = useAgentStore(selectProjectGroups);
  const emptyKey = useAgentStore((s) => emptySessionKey(s.sessions));
  const loading = useAgentStore((s) => s.historyLoading);
  const error = useAgentStore((s) => s.historyError);
  // Count of finished turns: a cheap signal to re-list after the agent saved a session.
  const finished = useAgentStore((s) =>
    Object.values(s.sessions).reduce((n, v) => n + (v.turn === "idle" ? v.items.length : 0), 0),
  );
  const filter = useUiStore((s) => s.projectFilter);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const { days, archived } = useMemo(() => {
    const all = flatSessions(visibleGroups(groups, emptyKey, root), filter);
    return {
      days: groupByDay(all.filter((e) => !e.archived)),
      archived: all.filter((e) => e.archived),
    };
  }, [groups, emptyKey, root, filter]);

  const worktrees = useWorktreeStore(selectWorktrees(root));
  // Chats in a worktree are listed under that folder: fetch them along with the repo's.
  const worktreeKey = worktrees
    .filter((w) => !w.main)
    .map((w) => w.path)
    .join("\n");

  useEffect(() => {
    if (root) void useWorktreeStore.getState().load(root);
  }, [root]);

  useEffect(() => {
    if (!root) return;
    const store = useAgentStore.getState();
    void store.refreshHistory(root);
    for (const path of worktreeKey ? worktreeKey.split("\n") : []) {
      void store.refreshHistory(path);
    }
  }, [root, finished, worktreeKey]);

  return (
    <div className="h-full overflow-y-auto px-2 pb-3 [scrollbar-width:thin]">
      {days.length === 0 ? (
        loading ? (
          <ListSkeleton />
        ) : (
          <div className="px-3 pt-8 text-center">
            <span className="mx-auto mb-3 grid size-9 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
              <MessagesSquare size={16} strokeWidth={1.5} aria-hidden className="text-fg-subtle" />
            </span>
            <p className="text-xs text-fg-muted">Henüz sohbet yok</p>
            <p className="mt-1 text-2xs leading-4 text-fg-subtle">
              {root ? "İlk mesajın burada görünür." : "Bir klasör açınca sohbetler burada."}
            </p>
          </div>
        )
      ) : (
        days.map((day) => (
          <section key={day.label} aria-label={day.label} className="mt-3 first:mt-1">
            <h3 className="px-2.5 pb-1 text-[11px] font-medium text-fg-subtle/80">{day.label}</h3>
            <ul className="flex flex-col gap-px">
              {day.entries.map((entry) => (
                <li key={`${entry.agentId}:${entry.sessionId}`}>
                  <SessionRow entry={entry} worktrees={worktrees} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {archived.length > 0 && (
        <section aria-label="Arşiv" className="mt-4">
          <button
            type="button"
            aria-expanded={archiveOpen}
            aria-controls="sidebar-archive"
            onClick={() => setArchiveOpen((v) => !v)}
            className="flex h-7 w-full items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium text-fg-subtle/80 transition-colors duration-fast hover:text-fg-muted"
          >
            <ChevronRight
              size={12}
              strokeWidth={2}
              aria-hidden
              className={cn(
                "transition-transform duration-base ease-out-quint",
                archiveOpen && "rotate-90",
              )}
            />
            Arşiv
            <span className="tabular-nums opacity-70">{archived.length}</span>
          </button>
          <Collapse open={archiveOpen} id="sidebar-archive">
            <ul className="flex flex-col gap-px">
              {archived.map((entry) => (
                <li key={`${entry.agentId}:${entry.sessionId}`}>
                  <SessionRow entry={entry} worktrees={worktrees} />
                </li>
              ))}
            </ul>
          </Collapse>
        </section>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 px-2.5 text-2xs text-fg-subtle">
          <p className="min-w-0 flex-1 whitespace-pre-line">{error}</p>
          {root && (
            <button
              type="button"
              onClick={() => void useAgentStore.getState().refreshHistory(root)}
              className="inline-flex shrink-0 items-center gap-1 text-fg-muted transition-colors duration-fast hover:text-fg"
            >
              <RotateCcw size={11} strokeWidth={1.75} aria-hidden />
              Yenile
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function openEntry(entry: SessionListEntry) {
  const store = useAgentStore.getState();
  if (entry.open) store.setActiveSession(entry.sessionId);
  else void store.loadSession(entry.agentId, entry.sessionId, entry.cwd);
}

const archive = (entry: SessionListEntry, archived: boolean) =>
  useAgentStore
    .getState()
    .archiveSession(entry, archived)
    .catch((err: unknown) => console.warn("sessions: archive failed", err));

const remove = (entry: SessionListEntry) =>
  useAgentStore
    .getState()
    .deleteSession(entry)
    .catch((err: unknown) => console.warn("sessions: delete failed", err));

/**
 * One conversation. Hover shows archive and delete; right-click opens the same actions.
 * Delete asks once, inside the row, so a stray click never loses a chat.
 */
function SessionRow({
  entry,
  worktrees,
}: {
  entry: SessionListEntry;
  /** The open repository's worktrees, to tag chats that run in one. */
  worktrees: readonly Worktree[];
}) {
  const worktree = worktreeOf(worktrees, entry.cwd);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const updated = entry.updatedAt ? Date.parse(entry.updatedAt) : NaN;
  const title = entry.title ? shortTitle(entry.title) : "Adsız sohbet";

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  if (confirming) {
    return (
      <div
        role="alertdialog"
        aria-label={`"${title}" silinsin mi?`}
        onMouseLeave={() => setConfirming(false)}
        className="flex h-8 items-center gap-2 rounded-lg bg-red-500/[0.08] pr-1 pl-2.5 text-[12px] ring-1 ring-red-500/20 ring-inset"
      >
        <span className="min-w-0 flex-1 truncate text-red-200/90">Silinsin mi?</span>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="h-6 rounded-md px-2 text-fg-muted transition-colors duration-fast hover:bg-white/[0.06] hover:text-fg"
        >
          Vazgeç
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => void remove(entry)}
          className="h-6 rounded-md bg-red-500/80 px-2 font-medium text-white transition-colors duration-fast hover:bg-red-500"
        >
          Sil
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        onContextMenu={onContextMenu}
        className={cn(
          "group relative flex h-8 items-center rounded-lg transition-[background-color,color] duration-fast",
          entry.active
            ? "bg-white/[0.07] text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
            : "text-fg-muted hover:bg-white/[0.04] hover:text-fg",
          menu && !entry.active && "bg-white/[0.04] text-fg",
        )}
      >
        <button
          type="button"
          onClick={() => openEntry(entry)}
          aria-current={entry.active ? "page" : undefined}
          title={entry.title ?? undefined}
          className="flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-lg pl-2.5 text-left text-[13px]"
        >
          {entry.running ? (
            // Working: a soft pulse in place of the agent mark.
            <span aria-hidden className="relative grid size-3.5 shrink-0 place-items-center">
              <span className="absolute size-2 animate-ping rounded-full bg-fg/40" />
              <span className="size-1.5 rounded-full bg-fg" />
            </span>
          ) : (
            <AgentGlyph
              agent={entry.agentId}
              size={13}
              tinted={entry.active}
              className={cn(
                "transition-colors duration-fast",
                !entry.active && "text-fg-subtle/70 group-hover:text-fg-subtle",
              )}
            />
          )}
          <span className={cn("min-w-0 flex-1 truncate", entry.running && "shimmer")}>{title}</span>
          {worktree && (
            <span
              title={`Worktree: ${worktree.branch ?? worktree.path}`}
              className="shrink-0 rounded-md bg-white/[0.06] px-1.5 font-mono text-[10px] leading-4 text-fg-subtle"
            >
              {worktreeName(worktree.path)}
            </span>
          )}
        </button>
        <span className="relative mr-1.5 ml-1 flex h-full shrink-0 items-center">
          {!entry.running && Number.isFinite(updated) && (
            <span className="text-[11px] text-fg-subtle/70 tabular-nums transition-opacity duration-fast group-focus-within:opacity-0 group-hover:opacity-0">
              {relativeTime(updated)}
            </span>
          )}
          <span className="absolute right-0 flex items-center gap-0.5 opacity-0 transition-opacity duration-fast group-focus-within:opacity-100 group-hover:opacity-100">
            <RowAction
              icon={entry.archived ? ArchiveRestore : Archive}
              label={entry.archived ? "Arşivden çıkar" : "Arşivle"}
              onClick={() => void archive(entry, !entry.archived)}
            />
            <RowAction icon={Trash2} label="Sil" danger onClick={() => setConfirming(true)} />
          </span>
        </span>
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label={title}
          onClose={() => setMenu(null)}
          items={[
            { label: "Aç", icon: MessageSquare, onSelect: () => openEntry(entry) },
            entry.archived
              ? {
                  label: "Arşivden çıkar",
                  icon: ArchiveRestore,
                  onSelect: () => void archive(entry, false),
                }
              : { label: "Arşivle", icon: Archive, onSelect: () => void archive(entry, true) },
            SEPARATOR,
            { label: "Sil", icon: Trash2, danger: true, onSelect: () => setConfirming(true) },
          ]}
        />
      )}
    </>
  );
}

interface RowActionProps {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onClick: () => void;
}

function RowAction({ icon: Icon, label, danger, onClick }: RowActionProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-6 place-items-center rounded-md text-fg-subtle transition-colors duration-fast",
        danger ? "hover:bg-red-500/15 hover:text-red-300" : "hover:bg-white/[0.08] hover:text-fg",
      )}
    >
      <Icon size={13} strokeWidth={1.75} aria-hidden />
    </button>
  );
}

function ListSkeleton() {
  return (
    <div aria-label="Sohbetler yükleniyor" className="flex flex-col gap-3 px-2.5 pt-3">
      {[70, 55, 80, 45].map((w) => (
        <div
          key={w}
          className="skeleton h-3 animate-skeleton rounded-full"
          style={{ width: `${w}%` }}
        />
      ))}
    </div>
  );
}
