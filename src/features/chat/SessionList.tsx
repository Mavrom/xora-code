import { useEffect, useMemo, useState } from "react";
import { ChevronRight, MessagesSquare, Pin, RotateCcw } from "lucide-react";
import { useUiStore } from "@/app/uiStore";
import { selectProjectGroups, useAgentStore } from "@/features/agents/store";
import { useWorkspaceStore } from "@/features/workspace/store";
import { selectWorktrees, useWorktreeStore } from "@/features/git/worktrees";
import { cn } from "@/shared/ui/cn";
import { Collapse } from "./Disclosure";
import { emptySessionKey, flatSessions, groupByDay, visibleGroups } from "./sessionListView";
import { SessionRow } from "./SessionRow";
import { t } from "@/shared/i18n";

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
  const { pinned, days, archived } = useMemo(() => {
    const all = flatSessions(visibleGroups(groups, emptyKey, root), filter);
    const live = all.filter((e) => !e.archived);
    return {
      pinned: live.filter((e) => e.pinned),
      days: groupByDay(live.filter((e) => !e.pinned)),
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
      {pinned.length > 0 && (
        <section aria-label={t("Pinned")} className="mt-1">
          <h3 className="flex items-center gap-1.5 px-2.5 pb-1 text-[11px] font-medium text-fg-subtle/80">
            <Pin size={10} strokeWidth={2} aria-hidden />
            {t("Pinned")}
          </h3>
          <ul className="flex flex-col gap-px">
            {pinned.map((entry) => (
              <li key={`${entry.agentId}:${entry.sessionId}`}>
                <SessionRow entry={entry} worktrees={worktrees} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {days.length === 0 && pinned.length === 0 ? (
        loading ? (
          <ListSkeleton />
        ) : (
          <div className="px-3 pt-8 text-center">
            <span className="mx-auto mb-3 grid size-9 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
              <MessagesSquare size={16} strokeWidth={1.5} aria-hidden className="text-fg-subtle" />
            </span>
            <p className="text-xs text-fg-muted">{t("No chats yet")}</p>
            <p className="mt-1 text-2xs leading-4 text-fg-subtle">
              {root
                ? t("Your first message shows up here.")
                : t("Open a folder and its chats appear here.")}
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
        <section aria-label={t("Archived")} className="mt-4">
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
            {t("Archived")}
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
              {t("Refresh")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div aria-label={t("Loading chats")} className="flex flex-col gap-3 px-2.5 pt-3">
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
