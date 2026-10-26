// Every open conversation holds an agent process (Claude Code runs one `claude` per
// session). Idle ones in the background are closed beyond a few recent ones; a closed
// conversation reopens from history when clicked.
import type { SessionView } from "./reducer";
import { useAgentStore } from "./store";

/** Idle background conversations kept open for an instant switch back. */
export const KEEP_OPEN = 3;

/** Safe to close: not the one on screen, and nothing in flight or waiting on the user. */
const idle = (v: SessionView, activeId: string | null) =>
  v.sessionId !== activeId &&
  v.turn === "idle" &&
  !v.loading &&
  v.permissions.length === 0 &&
  v.queued.length === 0;

/**
 * Sessions to close: idle background ones past the `keep` most recently shown
 * (`recent`, newest first; ones never shown count as oldest).
 */
export function sessionsToClose(
  sessions: Record<string, SessionView>,
  activeId: string | null,
  recent: readonly string[],
  keep = KEEP_OPEN,
): string[] {
  const rank = (id: string) => {
    const i = recent.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return Object.values(sessions)
    .filter((v) => idle(v, activeId))
    .sort((a, b) => rank(a.sessionId) - rank(b.sessionId))
    .slice(keep)
    .map((v) => v.sessionId);
}

/** Closes surplus idle sessions whenever the conversation on screen changes. */
export function installSessionReaper(store = useAgentStore, keep = KEEP_OPEN) {
  let recent: string[] = [];
  return store.subscribe((state, prev) => {
    if (state.activeSessionId === prev.activeSessionId) return;
    if (state.activeSessionId) {
      recent = [state.activeSessionId, ...recent.filter((id) => id !== state.activeSessionId)];
    }
    recent = recent.filter((id) => id in state.sessions);
    for (const id of sessionsToClose(state.sessions, state.activeSessionId, recent, keep)) {
      void state.closeSession(id);
    }
  });
}
