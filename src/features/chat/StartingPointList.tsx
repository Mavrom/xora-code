import { useMemo } from "react";
import { Inbox, PenLine } from "lucide-react";
import { selectProjectGroups, useAgentStore } from "@/features/agents/store";
import { sendToChat } from "@/features/commands/events";
import { selectWorktrees, useWorktreeStore } from "@/features/git/worktrees";
import { useInboxStore } from "@/features/inbox/store";
import { cn } from "@/shared/ui/cn";
import { t } from "@/shared/i18n";
import { chipClass } from "./chipStyles";
import { emptySessionKey, flatSessions, visibleGroups } from "./sessionListView";
import { noteLine, startingPoints, type StartingPoint } from "./startingPoints";

interface StartingPointListProps {
  /** The open repository, when there is one. */
  root: string | null;
  /** Where a new chat would work (the repository, a worktree, or null without a folder). */
  cwd: string | null;
  /** The (empty) chat on screen. */
  currentSessionId: string | null;
  /** Puts a starter prompt in the composer, unsent. */
  onPrompt: (text: string) => void;
}

/**
 * A quiet row under the new-chat composer of a project with no conversation yet: the top
 * Inbox note, or a starter prompt. Nothing here sends; a prompt or note only fills the composer.
 */
export function StartingPointList({
  root,
  cwd,
  currentSessionId,
  onPrompt,
}: StartingPointListProps) {
  const groups = useAgentStore(selectProjectGroups);
  const emptyKey = useAgentStore((s) => emptySessionKey(s.sessions));
  const notes = useInboxStore((s) => s.notes);
  const worktrees = useWorktreeStore(selectWorktrees(root));

  const points = useMemo(() => {
    const repo = root || cwd;
    const projectPaths = repo ? [repo, ...(cwd ? [cwd] : []), ...worktrees.map((w) => w.path)] : [];
    return startingPoints({
      sessions: flatSessions(visibleGroups(groups, emptyKey, cwd), null),
      projectPaths,
      currentSessionId,
      notes,
    });
  }, [groups, emptyKey, root, cwd, worktrees, currentSessionId, notes]);

  if (points.length === 0) return null;
  return (
    <ul
      aria-label={t("Starting points")}
      // Two columns as wide as the composer; one in a narrow chat panel.
      className="grid grid-cols-1 gap-x-1.5 gap-y-1 transition-[opacity,translate] duration-slow ease-out-quint starting:translate-y-1 starting:opacity-0 @[34rem]:grid-cols-2"
    >
      {points.map((point) => (
        <li key={keyOf(point)} className="min-w-0">
          <PointButton point={point} onPrompt={onPrompt} />
        </li>
      ))}
    </ul>
  );
}

const keyOf = (point: StartingPoint) =>
  point.kind === "note" ? `n:${point.note.id}` : `p:${point.prompt.label}`;

function PointButton({
  point,
  onPrompt,
}: {
  point: StartingPoint;
  onPrompt: (text: string) => void;
}) {
  // The outline chip of the row under the composer: bare until hovered, so it stays
  // secondary to the composer.
  const base = cn(chipClass(false, "outline"), "group w-full text-left");
  const icon = "shrink-0 text-fg-subtle transition-colors duration-fast group-hover:text-fg-muted";

  if (point.kind === "note") {
    const { note } = point;
    return (
      <button
        type="button"
        // Exactly what the Inbox's "Send to chat" (G) does: the note stays as it is.
        onClick={() => sendToChat(note.text)}
        title={t("Put this Inbox note in the message")}
        className={base}
      >
        <Inbox size={13} strokeWidth={1.75} aria-hidden className={icon} />
        <span className="sr-only">{t("Inbox note:")}</span>
        <span className="min-w-0 flex-1 truncate">{noteLine(note.text)}</span>
      </button>
    );
  }

  const { prompt } = point;
  return (
    <button
      type="button"
      onClick={() => onPrompt(t(prompt.text))}
      title={t(prompt.text)}
      className={base}
    >
      <PenLine size={13} strokeWidth={1.75} aria-hidden className={icon} />
      <span className="min-w-0 flex-1 truncate">{t(prompt.label)}</span>
    </button>
  );
}
