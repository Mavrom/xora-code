// Session plumbing for the chat panel: a "warm" empty session is opened as soon as the
// welcome shows, so the composer can display the real model / effort before the first
// message and the first token comes sooner. Empty sessions are reused, never piled up.
import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { sameProject } from "@/features/agents/sessionList";
import { useAgentStore } from "@/features/agents/store";
import type { AgentId, AgentStatus } from "@/features/agents/types";
import { ipc } from "@/shared/lib/ipc";
import { readGitBranch } from "./gitBranch";

/** In-flight session opens per agent + folder, so a fast first Enter awaits the same one. */
const opening = new Map<string, Promise<string>>();

/** Statuses in which opening a session makes sense (it starts the agent when stopped). */
export const canOpenSession = (status: AgentStatus) =>
  status.state === "ready" || status.state === "stopped" || status.state === "starting";

/** An open, still empty session of this agent in this folder, if any. */
function emptySessionFor(agentId: AgentId, cwd: string): string | null {
  const { sessions } = useAgentStore.getState();
  for (const view of Object.values(sessions)) {
    if (
      view.agentId === agentId &&
      sameProject(view.cwd, cwd) &&
      view.items.length === 0 &&
      !view.loading
    ) {
      return view.sessionId;
    }
  }
  return null;
}

/**
 * Closes this agent's untouched sessions in other folders (left from a previous folder or
 * worktree): each holds an agent process and would never be used again.
 */
function closeWarmElsewhere(agentId: AgentId, cwd: string) {
  const { sessions, activeSessionId, closeSession } = useAgentStore.getState();
  for (const view of Object.values(sessions)) {
    if (
      view.agentId === agentId &&
      view.sessionId !== activeSessionId &&
      view.items.length === 0 &&
      !view.loading &&
      !sameProject(view.cwd, cwd)
    ) {
      void closeSession(view.sessionId);
    }
  }
}

/**
 * Activates an empty session for `agentId` in `cwd`, reusing one that is open or opening.
 * Rejects with the store's raw error (auth, missing agent ...).
 */
export function ensureSession(agentId: AgentId, cwd: string): Promise<string> {
  const store = useAgentStore.getState();
  const existing = emptySessionFor(agentId, cwd);
  if (existing) {
    if (store.activeSessionId !== existing) store.setActiveSession(existing);
    return Promise.resolve(existing);
  }
  const key = `${agentId}|${cwd.toLowerCase()}`;
  let pending = opening.get(key);
  if (!pending) {
    pending = store.newSession(agentId, cwd).finally(() => opening.delete(key));
    opening.set(key, pending);
  }
  return pending;
}

/**
 * While the welcome has no session, keep an empty one ready for the selected agent. A
 * failed attempt is not retried for the same agent, folder and status, so it cannot loop;
 * a successful one is, so every "new chat" gets its warm session (and model chip) again.
 */
export function useWarmSession(
  enabled: boolean,
  agentId: AgentId,
  cwd: string | null,
  status: AgentStatus,
) {
  const [attempted] = useState(() => new Set<string>());
  useEffect(() => {
    if (!enabled || !cwd || !canOpenSession(status)) return;
    const key = `${agentId}|${cwd}|${status.state}`;
    if (attempted.has(key)) return;
    attempted.add(key);
    closeWarmElsewhere(agentId, cwd);
    ensureSession(agentId, cwd)
      .then(() => attempted.delete(key))
      .catch((err: unknown) => console.debug("chat: warm session failed", err));
  }, [enabled, agentId, cwd, status, attempted]);
}

/** Current git branch of `cwd`; re-read when the window regains focus or `refreshKey` changes. */
export function useGitBranch(cwd: string | null, refreshKey: unknown, fallback: string | null) {
  const [branch, setBranch] = useState<{ cwd: string; name: string | null } | null>(null);

  useEffect(() => {
    if (!cwd || !isTauri()) return;
    let alive = true;
    const read = () =>
      void readGitBranch(cwd, ipc.readFile).then((name) => {
        if (alive) setBranch({ cwd, name });
      });
    read();
    window.addEventListener("focus", read);
    return () => {
      alive = false;
      window.removeEventListener("focus", read);
    };
  }, [cwd, refreshKey]);

  return branch && branch.cwd === cwd ? branch.name : fallback;
}
