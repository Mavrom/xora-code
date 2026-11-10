// What a conversation row signals in the sidebar, and which chats finished unseen. Pure.
import type { SessionView } from "@/features/agents/reducer";

/** Strongest first: an approval blocks the agent, unread only asks for a look. */
export type SessionStatus = "approval" | "running" | "failed" | "unread" | "idle";

type StatusSource = Pick<SessionView, "turn" | "permissions" | "error">;

/** The one state a row shows. Sessions not open in this run (history only) are idle. */
export function sessionStatus(view: StatusSource | undefined, unread: boolean): SessionStatus {
  if (!view) return "idle";
  if (view.permissions.length > 0) return "approval";
  if (view.turn !== "idle") return "running";
  if (view.error) return "failed";
  return unread ? "unread" : "idle";
}

/**
 * Unread bookkeeping for one store change. A turn that ends (done, failed or cut off) in a
 * chat other than the active one marks it unread; becoming active clears it, and so does
 * the session leaving the store. The active chat is never unread, even while the window is
 * in the background: it is the one on screen when the user comes back, and the taskbar
 * flash already covers that case. Returns `unread` itself when nothing changed.
 */
export function nextUnread(
  unread: ReadonlySet<string>,
  prev: Record<string, SessionView>,
  next: Record<string, SessionView>,
  activeId: string | null,
): ReadonlySet<string> {
  const out = new Set(unread);
  for (const id of unread) {
    if (!(id in next) || id === activeId) out.delete(id);
  }
  if (prev !== next) {
    for (const [id, view] of Object.entries(next)) {
      const before = prev[id];
      if (id === activeId || !before) continue;
      if (before.turn !== "idle" && view.turn === "idle") out.add(id);
    }
  }
  const same = out.size === unread.size && [...out].every((id) => unread.has(id));
  return same ? unread : out;
}

/** Chats that need the user: waiting for approval, or finished unseen and not running again. */
export function attentionCount(
  sessions: Record<string, SessionView>,
  unread: ReadonlySet<string>,
): number {
  let count = 0;
  for (const [id, view] of Object.entries(sessions)) {
    const status = sessionStatus(view, unread.has(id));
    if (status === "approval" || (status !== "running" && unread.has(id))) count++;
  }
  return count;
}
