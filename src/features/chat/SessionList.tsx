import { useEffect, useId, useMemo, useState } from "react";
import { ChevronRight, MessagesSquare, RotateCcw, SquarePen } from "lucide-react";
import type { ProjectGroup, SessionListEntry } from "@/features/agents/sessionList";
import { selectProjectGroups, useAgentStore } from "@/features/agents/store";
import { relativeTime } from "@/features/inbox/relativeTime";
import { useWorkspaceStore } from "@/features/workspace/store";
import { cn } from "@/shared/ui/cn";
import { IconButton } from "@/shared/ui/IconButton";
import { PanelHeader } from "@/shared/ui/PanelHeader";
import { AgentGlyph } from "./AgentGlyph";
import { Collapse } from "./Disclosure";
import { emptySessionKey, visibleGroups } from "./sessionListView";

/**
 * Conversation history for the sidebar, grouped by project folder (the open workspace
 * first). Self-contained: reads the agent store and refreshes the agents' session lists
 * whenever the workspace changes or a turn finishes.
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
  const shown = useMemo(() => visibleGroups(groups, emptyKey, root), [groups, emptyKey, root]);

  useEffect(() => {
    if (root) void useAgentStore.getState().refreshHistory(root);
  }, [root, finished]);

  const newChat = () => useAgentStore.getState().setActiveSession(null);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Sohbetler"
        actions={<IconButton icon={SquarePen} label="Yeni sohbet" size="sm" onClick={newChat} />}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {shown.length === 0 ? (
          loading ? (
            <ListSkeleton />
          ) : (
            <div className="px-3 pt-6 text-center">
              <MessagesSquare
                size={18}
                strokeWidth={1.5}
                aria-hidden
                className="mx-auto mb-2 text-fg-subtle"
              />
              <p className="text-xs text-fg-muted">Henüz sohbet yok</p>
              <p className="mt-0.5 text-2xs text-fg-subtle">
                {root ? "İlk mesajın burada görünür." : "Bir klasör açınca sohbetleri burada."}
              </p>
            </div>
          )
        ) : (
          shown.map((group, index) => (
            <ProjectSection key={group.cwd} group={group} first={index === 0} />
          ))
        )}
        {error && (
          <div className="mt-2 flex items-start gap-2 px-2.5 text-2xs text-fg-subtle">
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
    </div>
  );
}

function ProjectSection({ group, first }: { group: ProjectGroup; first: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(true);
  return (
    <section aria-labelledby={`${id}-h`} className={cn(!first && "mt-2")}>
      <button
        type="button"
        id={`${id}-h`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        title={group.cwd}
        className="group flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-2xs font-medium text-fg-subtle transition-colors duration-fast hover:text-fg-muted"
      >
        <ChevronRight
          size={12}
          strokeWidth={1.75}
          aria-hidden
          className={cn(
            "shrink-0 transition-transform duration-base ease-out-quint",
            open && "rotate-90",
          )}
        />
        <span className="min-w-0 truncate">{group.name}</span>
        <span className="ml-auto tabular-nums opacity-0 transition-opacity duration-fast group-hover:opacity-100">
          {group.sessions.length}
        </span>
      </button>
      <Collapse open={open} id={id}>
        <ul className="flex flex-col gap-px">
          {group.sessions.map((entry) => (
            <li key={`${entry.agentId}:${entry.sessionId}`}>
              <SessionRow entry={entry} />
            </li>
          ))}
        </ul>
      </Collapse>
    </section>
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
        "relative flex h-8 w-full items-center gap-2 rounded-md pr-2 pl-6 text-left text-xs transition-colors duration-fast",
        entry.active ? "bg-elevated text-fg" : "text-fg-muted hover:bg-hover hover:text-fg",
      )}
    >
      {entry.active && (
        <span aria-hidden className="absolute top-2 bottom-2 left-2.5 w-px rounded-full bg-fg" />
      )}
      <AgentGlyph
        agent={entry.agentId}
        size={12}
        className={entry.active ? "text-fg-muted" : "text-fg-subtle"}
      />
      <span className={cn("min-w-0 flex-1 truncate", entry.running && "shimmer")}>
        {entry.title || "Adsız sohbet"}
      </span>
      {!entry.running && Number.isFinite(updated) && (
        <span className="shrink-0 text-2xs text-fg-subtle tabular-nums">
          {relativeTime(updated)}
        </span>
      )}
    </button>
  );
}

function ListSkeleton() {
  return (
    <div aria-label="Sohbetler yükleniyor" className="flex flex-col gap-2.5 px-2.5 pt-2">
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
