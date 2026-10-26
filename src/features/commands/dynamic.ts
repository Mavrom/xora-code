import { FolderClock, MessageSquareText } from "lucide-react";
import { useAgentStore } from "@/features/agents/store";
import type { AgentSessionInfo } from "@/features/agents/types";
import { useUiStore } from "@/app/uiStore";
import { openRecent } from "@/features/workspace/openFolder";
import { samePath } from "@/features/workspace/recents";
import { useWorkspaceStore } from "@/features/workspace/store";
import { basename } from "@/shared/lib/path";
import type { Command } from "./registry";

/** How many conversations / folders the palette lists before you type. */
export const MAX_DYNAMIC = 8;

/** "Go anywhere" entries: past conversations of the open folder and recent folders. */
export function buildDynamicCommands(
  history: AgentSessionInfo[],
  recents: string[],
  root: string | null,
  actions: { openSession: (s: AgentSessionInfo) => void; openFolder: (path: string) => void },
): Command[] {
  const sessions = history
    .filter((s) => root !== null && samePath(s.cwd, root))
    .slice(0, MAX_DYNAMIC)
    .map<Command>((s) => ({
      id: `session:${s.agentId}:${s.sessionId}`,
      title: s.title?.trim() || "Adsız sohbet",
      group: "Sohbetler",
      icon: MessageSquareText,
      run: () => actions.openSession(s),
    }));
  const folders = recents
    .filter((path) => root === null || !samePath(path, root))
    .slice(0, MAX_DYNAMIC)
    .map<Command>((path) => ({
      id: `folder:${path}`,
      title: basename(path),
      group: "Son klasörler",
      icon: FolderClock,
      run: () => actions.openFolder(path),
    }));
  return [...sessions, ...folders];
}

/** The live entries, read from the stores when the palette opens. */
export function dynamicCommands(): Command[] {
  const agents = useAgentStore.getState();
  const workspace = useWorkspaceStore.getState();
  return buildDynamicCommands(agents.history, workspace.recents, workspace.root, {
    openSession: (s) => {
      useUiStore.getState().setSidebarView("sessions");
      void useAgentStore.getState().loadSession(s.agentId, s.sessionId, s.cwd);
    },
    openFolder: (path) => void openRecent(path),
  });
}
