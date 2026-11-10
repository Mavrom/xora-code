// Which chats finished while the user was in another one. In memory only: after a restart
// no session is open, so there is nothing left to flag.
import { create } from "zustand";
import { useAgentStore } from "@/features/agents/store";
import { nextUnread } from "./sessionStatus";

export const useUnreadStore = create<{ ids: ReadonlySet<string> }>(() => ({ ids: new Set() }));

/** Keeps the unread set in step with the agent store's sessions and active chat. */
export function installUnread(store = useAgentStore, unread = useUnreadStore) {
  return store.subscribe((state, prev) => {
    if (state.sessions === prev.sessions && state.activeSessionId === prev.activeSessionId) return;
    const ids = unread.getState().ids;
    const next = nextUnread(ids, prev.sessions, state.sessions, state.activeSessionId);
    if (next !== ids) unread.setState({ ids: next });
  });
}
