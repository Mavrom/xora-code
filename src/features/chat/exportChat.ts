// "Sohbeti Markdown olarak kopyala" / "Sohbeti dışa aktar…" for the conversation on screen.
import { save } from "@tauri-apps/plugin-dialog";
import { selectActiveSession, useAgentStore } from "@/features/agents/store";
import { ipc } from "@/shared/lib/ipc";
import { sessionTitle } from "./sessionTitle";
import { transcriptFileName, transcriptMarkdown } from "./transcript";

function activeTranscript(): { markdown: string; title: string } | null {
  const state = useAgentStore.getState();
  const session = selectActiveSession(state);
  if (!session || session.items.length === 0) return null;
  const title = sessionTitle(session);
  const agent = state.agents[session.agentId]?.displayName ?? session.agentId;
  return { title, markdown: transcriptMarkdown(title, session.items, { agent, date: new Date() }) };
}

/** Whether there is a conversation to export. */
export const canExportChat = () => activeTranscript() !== null;

export async function copyChatMarkdown(): Promise<boolean> {
  const t = activeTranscript();
  if (!t) return false;
  await navigator.clipboard.writeText(t.markdown);
  return true;
}

/** Asks where to save, then writes the `.md` file. Resolves false when cancelled. */
export async function exportChatMarkdown(): Promise<boolean> {
  const t = activeTranscript();
  if (!t) return false;
  const path = await save({
    title: "Sohbeti dışa aktar",
    defaultPath: transcriptFileName(t.title),
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (!path) return false;
  await ipc.writeFile(path, t.markdown);
  return true;
}
