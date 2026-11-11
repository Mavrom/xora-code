import type { SessionListEntry } from "@/features/agents/sessionList";
import type { Worktree } from "@/features/git/worktrees";

export interface SessionRowProps {
  entry: SessionListEntry;
  /** The open repository's worktrees, to tag chats that run in one. */
  worktrees: readonly Worktree[];
}

/**
 * Whether a row would render the same: its entry field by field (the list rebuilds every
 * entry object whenever any session changes) and the same worktree list.
 */
export function sameRowProps(a: SessionRowProps, b: SessionRowProps): boolean {
  if (a.worktrees !== b.worktrees) return false;
  const keys = Object.keys(a.entry) as (keyof SessionListEntry)[];
  return (
    keys.length === Object.keys(b.entry).length && keys.every((k) => a.entry[k] === b.entry[k])
  );
}
