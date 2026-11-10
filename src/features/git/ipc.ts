// Typed wrappers around the Changes panel's Rust commands (`src-tauri/src/git/status.rs`,
// `changes.rs`). Paths are relative to the repository root, as `status` reports them.
import { invoke } from "@tauri-apps/api/core";

export type ChangeKind = "modified" | "added" | "deleted" | "renamed" | "copied" | "typeChanged";

export interface StatusEntry {
  /** Relative to the repository root, with forward slashes. */
  path: string;
  /** Old path of a rename or copy. */
  origPath: string | null;
  /** HEAD → index. */
  staged: ChangeKind | null;
  /** Index → working tree. */
  unstaged: ChangeKind | null;
  untracked: boolean;
  conflicted: boolean;
}

export interface GitStatus {
  /** Repository root, as git spells it. */
  root: string;
  /** Null when HEAD is detached. */
  branch: string | null;
  /** Short HEAD commit id; null before the first commit. */
  head: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  entries: StatusEntry[];
  /** Too many changes; only the first ones are listed. */
  truncated: boolean;
}

export interface GitDiff {
  /** Unified diff of one file; empty when that side has no change. */
  text: string;
  truncated: boolean;
}

/** Where `show` reads a file: the last commit or the staged content. */
export type GitRevision = "head" | "index";

export const gitIpc = {
  status: (dir: string) => invoke<GitStatus>("git_status", { dir }),
  stage: (dir: string, paths: string[]) => invoke<void>("git_stage", { dir, paths }),
  unstage: (dir: string, paths: string[]) => invoke<void>("git_unstage", { dir, paths }),
  /** Destructive: restores tracked files, deletes untracked ones. Staged content stays. */
  discard: (dir: string, paths: string[]) => invoke<void>("git_discard", { dir, paths }),
  /** `origPath`: the old path of a staged rename, so it diffs as a rename. */
  diff: (dir: string, path: string, staged: boolean, origPath: string | null = null) =>
    invoke<GitDiff>("git_diff", { dir, path, origPath, staged }),
  /**
   * A file's text at `rev`; null when it does not exist there. Rejects with `[binary]` or
   * `[too_large]` for content a diff tab should not show.
   */
  show: (dir: string, path: string, rev: GitRevision) =>
    invoke<string | null>("git_show", { dir, path, rev }),
  /** Resolves with the new commit's short id. */
  commit: (dir: string, message: string) => invoke<string>("git_commit", { dir, message }),
  push: (dir: string) => invoke<void>("git_push", { dir }),
  pull: (dir: string) => invoke<void>("git_pull", { dir }),
};
