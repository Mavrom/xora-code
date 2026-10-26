import { useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, MessagesSquare, RotateCcw, SquarePen } from "lucide-react";
import { useUiStore } from "@/app/uiStore";
import type { SessionListEntry } from "@/features/agents/sessionList";
import { selectProjectGroups, useAgentStore } from "@/features/agents/store";
import { relativeTime } from "@/features/inbox/relativeTime";
import { useWorkspaceStore } from "@/features/workspace/store";
import { cn } from "@/shared/ui/cn";
import { IconButton } from "@/shared/ui/IconButton";
import { AgentGlyph } from "./AgentGlyph";
import { Collapse } from "./Disclosure";
import { emptySessionKey, flatSessions, visibleGroups } from "./sessionListView";

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
  const filter = useUiStore((s) => s.projectFilter);
  const shown = useMemo(
    () => flatSessions(visibleGroups(groups, emptyKey, root), filter),
    [groups, emptyKey, root, filter],
  );
  const id = useId();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (root) void useAgentStore.getState().refreshHistory(root);
  }, [root, finished]);

  const newChat = () => useAgentStore.getState().setActiveSession(null);

  return (
    <div className="flex h-full flex-col">
      <div className="group/h flex h-8 shrink-0 items-center gap-1 pr-2 pl-3.5">
        <h2 id={`${id}-h`} className="min-w-0 flex-1 truncate text-xs text-fg-subtle">
          Oturumlar
        </h2>
        <span className="opacity-0 transition-opacity duration-fast group-hover/h:opacity-100 focus-within:opacity-100">
          <IconButton icon={SquarePen} label="Yeni sohbet" size="sm" onClick={newChat} />
        </span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={open ? "Oturumları daralt" : "Oturumları genişlet"}
          title={open ? "Daralt" : "Genişlet"}
          onClick={() => setOpen((v) => !v)}
          className="grid size-6 place-items-center rounded-md text-fg-subtle transition-colors duration-fast hover:bg-hover hover:text-fg"
        >
          <ChevronDown
            size={13}
            strokeWidth={1.75}
            aria-hidden
            className={cn(
              "transition-transform duration-base ease-out-quint",
              !open && "-rotate-90",
            )}
          />
        </button>
      </div>
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
          <Collapse open={open} id={id}>
            <ul aria-labelledby={`${id}-h`} className="flex flex-col gap-px">
              {shown.map((entry) => (
                <li key={`${entry.agentId}:${entry.sessionId}`}>
                  <SessionRow entry={entry} />
                </li>
              ))}
            </ul>
          </Collapse>
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
        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors duration-fast",
        entry.active ? "bg-elevated text-fg" : "text-fg-muted hover:bg-hover hover:text-fg",
      )}
    >
      {/* Status dot: lit while the agent works, faint otherwise. */}
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          entry.running ? "animate-pulse bg-fg" : "bg-fg-subtle/50",
        )}
      />
      <AgentGlyph agent={entry.agentId} size={13} tinted />
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
