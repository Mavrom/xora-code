// "Sohbeti Markdown olarak kopyala" / "Sohbeti dışa aktar…" for the conversation on screen.
import { save } from "@tauri-apps/plugin-dialog";
import { selectActiveSession, useAgentStore } from "@/features/agents/store";
import type { AgentId } from "@/features/agents/types";
import { sendToChat } from "@/features/commands/events";
import { ipc } from "@/shared/lib/ipc";
import { sessionTitle } from "./sessionTitle";
import { handoffPrompt, transcriptFileName, transcriptMarkdown } from "./transcript";
import { t } from "@/shared/i18n";

function activeTranscript(): { markdown: string; title: string; agent: string } | null {
  const state = useAgentStore.getState();
  const session = selectActiveSession(state);
  if (!session || session.items.length === 0) return null;
  const title = sessionTitle(session);
  const agent = state.agents[session.agentId]?.displayName ?? session.agentId;
  return {
    title,
    agent,
    markdown: transcriptMarkdown(title, session.items, { agent, date: new Date() }),
  };
}

/** Whether there is a conversation to export. */
export const canExportChat = () => activeTranscript() !== null;

export async function copyChatMarkdown(): Promise<boolean> {
  const chat = activeTranscript();
  if (!chat) return false;
  await navigator.clipboard.writeText(chat.markdown);
  return true;
}

/** Asks where to save, then writes the `.md` file. Resolves false when cancelled. */
export async function exportChatMarkdown(): Promise<boolean> {
  const chat = activeTranscript();
  if (!chat) return false;
  const path = await save({
    title: t("Export chat"),
    defaultPath: transcriptFileName(chat.title),
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (!path) return false;
  await ipc.writeFile(path, chat.markdown);
  return true;
}

/** Other agents that can take the conversation on screen over: signed in and running,
 * or installed and stopped (they start when picked). */
export function handoffTargets(): { id: AgentId; name: string }[] {
  const state = useAgentStore.getState();
  const current = selectActiveSession(state)?.agentId;
  return Object.values(state.agents)
    .filter((a) => a.id !== current && (a.status.state === "ready" || a.status.state === "stopped"))
    .map((a) => ({ id: a.id, name: a.displayName }));
}

/**
 * Hands the conversation to another agent: a new chat with `target`, its composer filled
 * with what happened so far, ready to send (nothing is sent on the user's behalf).
 */
export function handOffTo(target: AgentId): boolean {
  const chat = activeTranscript();
  if (!chat) return false;
  const store = useAgentStore.getState();
  store.selectAgent(target);
  store.setActiveSession(null);
  // The new chat's composer mounts on the next frame.
  requestAnimationFrame(() => sendToChat(handoffPrompt(chat.agent, chat.markdown)));
  return true;
}
