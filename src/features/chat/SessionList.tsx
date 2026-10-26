import { useEffect, useMemo } from "react";
import { MessagesSquare, RotateCcw } from "lucide-react";
import { useUiStore } from "@/app/uiStore";
import type { SessionListEntry } from "@/features/agents/sessionList";
import { selectProjectGroups, useAgentStore } from "@/features/agents/store";
import { relativeTime } from "@/features/inbox/relativeTime";
import { useWorkspaceStore } from "@/features/workspace/store";
import { cn } from "@/shared/ui/cn";
import { AgentGlyph } from "./AgentGlyph";
import { emptySessionKey, flatSessions, groupByDay, visibleGroups } from "./sessionListView";

/**
 * Conversation history for the sidebar: one newest-first list (or one project's, from the
 * project picker) under quiet day headings. Self-contained: reads the agent store and
 * refreshes the agents' session lists whenever the workspace changes or a turn finishes.
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
  const days = useMemo(
    () => groupByDay(flatSessions(visibleGroups(groups, emptyKey, root), filter)),
    [groups, emptyKey, root, filter],
  );

  useEffect(() => {
    if (root) void useAgentStore.getState().refreshHistory(root);
  }, [root, finished]);

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
                  <SessionRow entry={entry} />
                </li>
              ))}
            </ul>
          </section>
        ))
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

function SessionRow({ entry }: { entry: SessionListEntry }) {
  const updated = entry.updatedAt ? Date.parse(entry.updatedAt) : NaN;
  const open = () => {
    const store = useAgentStore.getState();
    if (entry.open) store.setActiveSession(entry.sessionId);
    else void store.loadSession(entry.agentId, entry.sessionId, entry.cwd);
  };
  return (
    <button
      type="button"
      onClick={open}
      aria-current={entry.active ? "page" : undefined}
      title={entry.title ?? undefined}
      className={cn(
        "group relative flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-[background-color,color] duration-fast",
        entry.active
          ? "bg-white/[0.07] text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
          : "text-fg-muted hover:bg-white/[0.04] hover:text-fg",
      )}
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
      <span className={cn("min-w-0 flex-1 truncate", entry.running && "shimmer")}>
        {entry.title || "Adsız sohbet"}
      </span>
      {!entry.running && Number.isFinite(updated) && (
        <span className="shrink-0 text-[11px] text-fg-subtle/70 tabular-nums">
          {relativeTime(updated)}
        </span>
      )}
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
