// Sidebar ordering on top of package C's project groups: untouched (empty) open sessions are
// hidden, and the open workspace's group comes first.
import {
  sameProject,
  type ProjectGroup,
  type SessionListEntry,
} from "@/features/agents/sessionList";
import type { SessionView } from "@/features/agents/reducer";

/** Stable key of the open sessions that have no messages yet ("" when none). */
export function emptySessionKey(sessions: Record<string, SessionView>): string {
  return Object.values(sessions)
    .filter((v) => v.items.length === 0 && !v.loading)
    .map((v) => v.sessionId)
    .sort()
    .join("\n");
}

export function visibleGroups(
  groups: readonly ProjectGroup[],
  emptyKey: string,
  currentCwd: string | null,
): ProjectGroup[] {
  const empty = new Set(emptyKey ? emptyKey.split("\n") : []);
  // An open session without messages is the welcome screen (or a warm spare), not a
  // conversation yet.
  const out = groups
    .map((g) => ({ ...g, sessions: g.sessions.filter((s) => !(s.open && empty.has(s.sessionId))) }))
    .filter((g) => g.sessions.length > 0);
  if (!currentCwd) return out;
  const index = out.findIndex((g) => sameProject(g.cwd, currentCwd));
  if (index > 0) out.unshift(...out.splice(index, 1));
  return out;
}

/** One newest-first list across projects, or just `project`'s sessions when set. */
export function flatSessions(
  groups: readonly ProjectGroup[],
  project: string | null,
): SessionListEntry[] {
  const picked = project ? groups.filter((g) => sameProject(g.cwd, project)) : groups;
  // Open sessions without a timestamp are the ones in use right now: keep them on top.
  const rank = (e: SessionListEntry) =>
    e.updatedAt ? Date.parse(e.updatedAt) || 0 : e.open ? Number.MAX_SAFE_INTEGER : 0;
  return picked.flatMap((g) => g.sessions).sort((a, b) => rank(b) - rank(a));
}
