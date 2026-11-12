import { useEffect, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { selectActiveSession, useAgentStore } from "@/features/agents/store";
import { onFsChange } from "@/features/workspace/fsWatch";
import { useWorkspaceStore } from "@/features/workspace/store";
import { useUiStore } from "@/app/uiStore";
import { activeCheckout } from "./changes";
import { useChangesStore } from "./changesStore";
import { useWorktreeStore } from "./worktrees";

/** The checkout the chat works in (see `activeCheckout`). */
export function useActiveCheckout(): string | null {
  const sessionCwd = useAgentStore((s) => selectActiveSession(s)?.cwd ?? null);
  const selected = useWorktreeStore((s) => s.selected);
  const root = useWorkspaceStore((s) => s.root);
  return activeCheckout(sessionCwd, selected, root);
}

/**
 * Keeps the Changes status current without polling: on a checkout switch, opening the
 * view, window focus, the end of an agent turn and (debounced) file system events. Mount
 * once, where it stays mounted, so the sidebar badge is right before the view is opened.
 */
export function useChangesSync() {
  const dir = useActiveCheckout();
  const turn = useAgentStore((s) => selectActiveSession(s)?.turn ?? "idle");
  const viewOpen = useUiStore((s) => s.sidebarView === "changes");
  const lastTurn = useRef(turn);
  const enabled = isTauri();

  useEffect(() => {
    if (enabled) void useChangesStore.getState().setDir(dir);
  }, [enabled, dir]);

  useEffect(() => {
    if (enabled && viewOpen) void useChangesStore.getState().refresh();
  }, [enabled, viewOpen]);

  // An agent that just finished has usually changed files (or committed them).
  useEffect(() => {
    const finished = lastTurn.current !== "idle" && turn === "idle";
    lastTurn.current = turn;
    if (enabled && finished) void useChangesStore.getState().refresh();
  }, [enabled, turn]);

  useEffect(() => {
    if (!enabled) return;
    const store = useChangesStore.getState;
    const onFocus = () => void store().refresh();
    window.addEventListener("focus", onFocus);
    // The watcher covers the open folder (not `.git`); a worktree elsewhere relies on the
    // other triggers.
    const off = onFsChange(() => store().refreshSoon());
    return () => {
      window.removeEventListener("focus", onFocus);
      off();
    };
  }, [enabled]);
}
