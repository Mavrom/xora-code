import { useEffect } from "react";
import { watchRoot } from "./fsWatch";
import { persistWorkspaceSession, restoreLastWorkspace } from "./restore";
import { useWorkspaceStore } from "./store";

/**
 * Settings seam: "open last folder on start" (Settings `general.openLastFolder`, default on).
 * At merge: `async () => (await ensureSettingsLoaded()).general.openLastFolder`.
 */
const openLastFolderOnStart = () => true;

/**
 * App-lifetime workspace duties, mounted once by the always-present file tree: reopen the
 * last folder and its tabs, remember tabs from now on, and keep a file watcher on the root.
 */
export function useWorkspaceLifecycle() {
  const root = useWorkspaceStore((s) => s.root);

  useEffect(() => {
    persistWorkspaceSession();
    void restoreLastWorkspace({ enabled: openLastFolderOnStart });
  }, []);

  useEffect(() => {
    void watchRoot(root);
  }, [root]);
}
