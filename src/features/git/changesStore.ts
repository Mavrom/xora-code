// Status of the active checkout for the Changes panel and its sidebar badge. Refreshed on
// demand (see `useChangesSync`), never by polling; overlapping refreshes collapse into one
// follow-up so a burst of file events costs at most two `git status` runs.
import { create } from "zustand";
import { describeChangesError } from "./changes";
import { gitIpc, type GitStatus } from "./ipc";
import { t } from "@/shared/i18n";

export type GitAction = "stage" | "unstage" | "discard" | "commit" | "push" | "pull";

/** Why there is no status to show (null while there is one, or before the first load). */
export type ChangesProblem = "no_folder" | "not_repo" | "error";

export interface ChangesState {
  /** The checkout shown: the active chat's working folder. */
  dir: string | null;
  status: GitStatus | null;
  problem: ChangesProblem | null;
  /** Error text for `problem: "error"`. */
  error: string | null;
  loading: boolean;
  /** The git action running now; others wait (buttons are disabled meanwhile). */
  busy: GitAction | null;
  /** Result of the last action, shown under the branch line until dismissed. */
  notice: { text: string; error: boolean } | null;
  /** Bumped on every successful refresh, so open diffs know to reload. */
  version: number;
  /** Points the store at another checkout and loads it; resolves once loaded. */
  setDir: (dir: string | null) => Promise<void>;
  refresh: () => Promise<void>;
  /** Refresh after `delay` ms, restarting the wait on every call (file event bursts). */
  refreshSoon: (delay?: number) => void;
  stage: (paths: string[]) => Promise<boolean>;
  unstage: (paths: string[]) => Promise<boolean>;
  discard: (paths: string[]) => Promise<boolean>;
  commit: (message: string) => Promise<boolean>;
  push: () => Promise<boolean>;
  pull: () => Promise<boolean>;
  setNotice: (notice: ChangesState["notice"]) => void;
}

export const REFRESH_DEBOUNCE_MS = 300;

/**
 * Whether the notice line sits under the branch line (git status loaded) rather than under
 * the view's header. Either way it shows: a turn's accept or revert can fail in a folder
 * git cannot read, and its error must not be lost.
 */
export const noticeUnderBranch = (s: Pick<ChangesState, "status" | "problem">): boolean =>
  s.problem === null && s.status !== null;

let inflight: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;

export const useChangesStore = create<ChangesState>((set, get) => {
  const load = async () => {
    const dir = get().dir;
    if (!dir) {
      set({ status: null, problem: "no_folder", error: null, loading: false });
      return;
    }
    set({ loading: true });
    try {
      const status = await gitIpc.status(dir);
      if (get().dir !== dir) return; // switched checkouts meanwhile
      set({ status, problem: null, error: null, version: get().version + 1 });
    } catch (err) {
      if (get().dir !== dir) return;
      const notRepo = String(err).startsWith("[not_repo]");
      set({
        status: null,
        problem: notRepo ? "not_repo" : "error",
        error: notRepo ? null : describeChangesError(err),
      });
    } finally {
      if (get().dir === dir) set({ loading: false });
    }
  };

  const refresh = (): Promise<void> => {
    if (inflight) {
      again = true;
      return inflight;
    }
    inflight = (async () => {
      do {
        again = false;
        await load();
      } while (again);
    })().finally(() => {
      inflight = null;
    });
    return inflight;
  };

  /** Runs one git action at a time, reports its failure, then refreshes. */
  const run = async <T>(
    action: GitAction,
    job: (dir: string) => Promise<T>,
    done?: (result: T) => string,
  ): Promise<boolean> => {
    const dir = get().dir;
    if (!dir || get().busy) return false;
    set({ busy: action, notice: null });
    try {
      const result = await job(dir);
      if (done) set({ notice: { text: done(result), error: false } });
      return true;
    } catch (err) {
      set({ notice: { text: describeChangesError(err), error: true } });
      return false;
    } finally {
      set({ busy: null });
      await refresh();
    }
  };

  return {
    dir: null,
    status: null,
    problem: "no_folder",
    error: null,
    loading: false,
    busy: null,
    notice: null,
    version: 0,
    setDir: (dir) => {
      if (dir === get().dir) return Promise.resolve();
      set({ dir, status: null, problem: null, error: null, notice: null });
      return refresh();
    },
    refresh,
    refreshSoon: (delay = REFRESH_DEBOUNCE_MS) => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), delay);
    },
    stage: (paths) => run("stage", (dir) => gitIpc.stage(dir, paths)),
    unstage: (paths) => run("unstage", (dir) => gitIpc.unstage(dir, paths)),
    discard: (paths) => run("discard", (dir) => gitIpc.discard(dir, paths)),
    commit: (message) =>
      run(
        "commit",
        (dir) => gitIpc.commit(dir, message),
        (id) => t("Committed {id}.", { id }),
      ),
    push: () =>
      run(
        "push",
        (dir) => gitIpc.push(dir),
        () => t("Pushed."),
      ),
    pull: () =>
      run(
        "pull",
        (dir) => gitIpc.pull(dir),
        () => t("Pulled."),
      ),
    setNotice: (notice) => set({ notice }),
  };
});
