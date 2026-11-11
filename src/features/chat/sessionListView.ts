// Sidebar ordering on top of the agent store's project groups (`groupByProject`): untouched
// (empty) open sessions are hidden, and the open workspace's group comes first.
import {
  sameProject,
  type ProjectGroup,
  type SessionListEntry,
} from "@/features/agents/sessionList";
import type { SessionView } from "@/features/agents/reducer";
import { t } from "@/shared/i18n";

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

/**
 * When a session was last used, for sorting and the day headings. An open session without
 * a (readable) timestamp is the one in use right now; a closed one without it is placed
 * last, as the oldest. Both the order and the headings use this, so they never disagree.
 */
function sessionTime(e: SessionListEntry): number {
  const time = e.updatedAt ? Date.parse(e.updatedAt) : NaN;
  if (Number.isFinite(time)) return time;
  return e.open ? Number.MAX_SAFE_INTEGER : 0;
}

/** One newest-first list across projects, or just `project`'s sessions when set. */
export function flatSessions(
  groups: readonly ProjectGroup[],
  project: string | null,
): SessionListEntry[] {
  const picked = project ? groups.filter((g) => sameProject(g.cwd, project)) : groups;
  return picked.flatMap((g) => g.sessions).sort((a, b) => sessionTime(b) - sessionTime(a));
}

export interface DayGroup {
  label: string;
  entries: SessionListEntry[];
}

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);

/**
 * Splits a newest-first list into "Bugün", "Dün", "Bu hafta" and "Daha eski". An open
 * session with no timestamp counts as today, a closed one as older (`sessionTime`).
 */
export function groupByDay(entries: readonly SessionListEntry[], now = Date.now()): DayGroup[] {
  const today = startOfDay(now);
  const labelFor = (e: SessionListEntry) => {
    const time = sessionTime(e);
    if (time >= today) return t("Today");
    if (time >= today - DAY) return t("Yesterday");
    if (time >= today - 6 * DAY) return t("This week");
    return t("Older");
  };
  const groups: DayGroup[] = [];
  for (const entry of entries) {
    const label = labelFor(entry);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }
  return groups;
}
