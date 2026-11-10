import type { SessionListEntry } from "@/features/agents/sessionList";
import { useAgentStore } from "@/features/agents/store";

/** Shows a listed conversation: switches to it when open, else loads it from the agent. */
export function openEntry(entry: SessionListEntry) {
  const store = useAgentStore.getState();
  if (entry.open) store.setActiveSession(entry.sessionId);
  else void store.loadSession(entry.agentId, entry.sessionId, entry.cwd);
}
