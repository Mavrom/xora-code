import { ipc } from "@/shared/lib/ipc";
import { parseFsError } from "@/features/files/fsErrors";
import { useEditorStore } from "@/features/editor/store";
import { makeSession, parseSession } from "./session";
import { useWorkspaceStore } from "./store";

const SESSION_KEY = "xora.workspace.session";
const SESSION_SAVE_MS = 400;

function readSessionRaw(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

let restoreStarted = false;

export interface RestoreOptions {
  /**
   * The "open last folder on start" setting. Wired to Settings at merge:
   * `async () => (await ensureSettingsLoaded()).general.openLastFolder`.
   */
  enabled: () => boolean | Promise<boolean>;
}

/**
 * Reopens the most recent folder and its tabs, once per app start. Does nothing when the
 * setting is off, when the user already opened a folder, or when the folder is gone (it is
 * then dropped from the recent list). Never rejects.
 */
export async function restoreLastWorkspace({ enabled }: RestoreOptions): Promise<void> {
  if (restoreStarted) return;
  restoreStarted = true;
  try {
    if (!(await enabled())) return;
    const last = useWorkspaceStore.getState().recents[0];
    if (!last) return;
    try {
      await ipc.listDir(last);
    } catch (err) {
      if (parseFsError(err).code === "not_found") useWorkspaceStore.getState().forgetRecent(last);
      return;
    }
    // The user may have picked a folder while we were checking.
    if (useWorkspaceStore.getState().root !== null) return;
    useWorkspaceStore.getState().setRoot(last);
    await restoreTabs(last);
  } catch (err) {
    console.error("cannot restore the last workspace", err);
  }
}

async function restoreTabs(root: string) {
  const session = parseSession(readSessionRaw(), root);
  if (!session || session.tabs.length === 0) return;
  const reads = await Promise.allSettled(session.tabs.map((path) => ipc.readFile(path)));
  const editor = useEditorStore.getState();
  // Files the user opened meanwhile stay where they are; restored ones go first.
  if (editor.tabs.length > 0) return;
  session.tabs.forEach((path, i) => {
    const read = reads[i];
    if (read.status === "fulfilled") editor.openFile(path, read.value);
  });
  const opened = useEditorStore.getState().tabs;
  const active = opened.find((t) => t.path === session.active) ?? opened[opened.length - 1];
  if (active) editor.setActive(active.path);
}

let persisting = false;

/**
 * Keeps the open tabs of the current folder in localStorage so the next start can reopen
 * them. Installed once; returns nothing because it lives as long as the app.
 */
export function persistWorkspaceSession() {
  if (persisting) return;
  persisting = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const root = useWorkspaceStore.getState().root;
      if (!root) return;
      const { tabs, activePath } = useEditorStore.getState();
      const session = makeSession(
        root,
        tabs.map((t) => t.path),
        activePath,
      );
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch {
        // Not persisted; nothing else depends on it.
      }
    }, SESSION_SAVE_MS);
  };
  // Only the tab list and the active tab matter, not every keystroke's content change.
  useEditorStore.subscribe((state, prev) => {
    if (state.activePath !== prev.activePath || state.tabs.length !== prev.tabs.length) save();
  });
}
