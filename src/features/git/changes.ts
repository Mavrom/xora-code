// Pure pieces of the Changes panel: which checkout it shows, how entries group into
// "Staged" and "Changes" rows, status letters and error texts.
import { t } from "@/shared/i18n";
import type { ChangeKind, GitRevision, GitStatus, StatusEntry } from "./ipc";

/**
 * The checkout the panel shows, the same one the chat works in: the active chat's folder
 * (its worktree when it has one), else the worktree picked for new chats, else the folder.
 */
export function activeCheckout(
  sessionCwd: string | null | undefined,
  selectedWorktree: string | null,
  root: string | null,
): string | null {
  return sessionCwd || selectedWorktree || root || null;
}

export type RowKind = ChangeKind | "untracked" | "conflicted";

export interface ChangeRow {
  path: string;
  origPath: string | null;
  kind: RowKind;
  /** In the "Staged" group (index side) rather than "Changes" (working tree side). */
  staged: boolean;
}

/** A file with both staged and unstaged changes shows up in both groups. */
export function groupChanges(entries: readonly StatusEntry[]): {
  staged: ChangeRow[];
  changes: ChangeRow[];
} {
  const staged: ChangeRow[] = [];
  const changes: ChangeRow[] = [];
  for (const e of entries) {
    if (e.staged) {
      staged.push({ path: e.path, origPath: e.origPath, kind: e.staged, staged: true });
    }
    const kind: RowKind | null = e.conflicted
      ? "conflicted"
      : e.untracked
        ? "untracked"
        : e.unstaged;
    if (kind) changes.push({ path: e.path, origPath: null, kind, staged: false });
  }
  return { staged, changes };
}

/** Paths to hand to git for a set of rows; a staged rename also needs its old path. */
export function rowPaths(rows: readonly ChangeRow[]): string[] {
  const paths = rows.flatMap((r) => (r.origPath ? [r.path, r.origPath] : [r.path]));
  return [...new Set(paths)];
}

/**
 * Absolute path of a repository file for the editor. Git spells Windows roots with forward
 * slashes ("C:/repo"); the rest of the app uses backslashes there, so tabs do not double up.
 */
export function filePath(root: string, path: string): string {
  const full = `${root.replace(/[\\/]+$/, "")}/${path}`;
  return /^[A-Za-z]:[\\/]/.test(root) ? full.replace(/\//g, "\\") : full;
}

/** Where one side of a row's diff tab comes from: git, the file on disk, or nothing. */
export type DiffSide =
  { from: "git"; rev: GitRevision; path: string } | { from: "disk" } | { from: "none" };

const NONE: DiffSide = { from: "none" };

/**
 * The two sides of a row's diff tab, matching its inline diff. Staged: HEAD (at the old
 * path of a rename) against the index. Unstaged: the index against the file on disk; an
 * untracked file has nothing on the left, a conflicted one (no staged version) HEAD.
 */
export function diffSides(row: ChangeRow): { left: DiffSide; right: DiffSide } {
  if (row.staged) {
    return {
      left:
        row.kind === "added" ? NONE : { from: "git", rev: "head", path: row.origPath ?? row.path },
      right: row.kind === "deleted" ? NONE : { from: "git", rev: "index", path: row.path },
    };
  }
  const index: DiffSide = { from: "git", rev: "index", path: row.path };
  switch (row.kind) {
    case "untracked":
      return { left: NONE, right: { from: "disk" } };
    case "conflicted":
      return { left: { from: "git", rev: "head", path: row.path }, right: { from: "disk" } };
    case "deleted":
      return { left: index, right: NONE };
    default:
      return { left: index, right: { from: "disk" } };
  }
}

/** Title and warning of the confirm dialog before discarding `rows`. */
export function discardPrompt(rows: readonly ChangeRow[]): { title: string; message: string } {
  const title =
    rows.length === 1
      ? t('Discard changes to "{name}"?', { name: splitPath(rows[0].path).name })
      : t("Discard changes to {n} files?", { n: rows.length });
  const message = rows.some((r) => r.kind === "untracked")
    ? t("New files are deleted. This cannot be undone.")
    : t("This cannot be undone.");
  return { title, message };
}

/** Files with any change: the sidebar badge. */
export const changeCount = (status: GitStatus | null): number => status?.entries.length ?? 0;

/** "src/app/Main.tsx" → name "Main.tsx", dir "src/app". */
export function splitPath(path: string): { name: string; dir: string } {
  const slash = path.lastIndexOf("/");
  return slash === -1
    ? { name: path, dir: "" }
    : { name: path.slice(slash + 1), dir: path.slice(0, slash) };
}

const LETTERS: Record<RowKind, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  copied: "C",
  typeChanged: "T",
  untracked: "U",
  conflicted: "!",
};

/** The status letter, VS Code style. */
export const statusLetter = (kind: RowKind) => LETTERS[kind];

/** Spoken and tooltip name of a status. */
export function statusLabel(kind: RowKind): string {
  switch (kind) {
    case "modified":
      return t("Modified");
    case "added":
      return t("Added");
    case "deleted":
      return t("Deleted");
    case "renamed":
      return t("Renamed");
    case "copied":
      return t("Copied");
    case "typeChanged":
      return t("Type changed");
    case "untracked":
      return t("Untracked");
    case "conflicted":
      return t("Conflicted");
  }
}

/** Text colour of the status letter, from the existing tokens. */
export function statusTone(kind: RowKind): string {
  switch (kind) {
    case "added":
    case "untracked":
      return "text-fg";
    case "modified":
      return "text-warning";
    case "deleted":
    case "conflicted":
      return "text-danger";
    default:
      return "text-fg-muted";
  }
}

/** Why Commit is disabled, or null when it can run. */
export function commitBlocker(status: GitStatus | null, message: string): string | null {
  if (!status) return t("Not a git repository.");
  if (status.entries.some((e) => e.conflicted)) return t("Resolve the conflicts first.");
  if (!status.entries.some((e) => e.staged)) return t("Stage changes to commit them.");
  if (!message.trim()) return t("Write a commit message.");
  return null;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The `code` of a `[code] …` error from the git (or file) commands, if it has one. */
export const changesErrorCode = (err: unknown): string | undefined =>
  /^\[([a-z_]+)\]/.exec(errorText(err))?.[1];

/** Text for a `[code] …` error from the git commands. */
export function describeChangesError(err: unknown): string {
  const text = errorText(err);
  const code = changesErrorCode(err);
  const detail = text.replace(/^\[[a-z_]+\]\s*/, "");
  switch (code) {
    case "no_git":
      return t("Git not found. Install Git to use the Changes view.");
    case "not_repo":
      return t("Not a git repository.");
    case "binary":
      return t("Binary file; no preview.");
    case "too_large":
      return t("The file is too large to show as a diff.");
    case "conflicted":
      return t("Resolve the conflicts first.");
    case "nothing_staged":
      return t("Stage changes to commit them.");
    case "empty_message":
      return t("Write a commit message.");
    case "no_identity":
      return t("Git does not know who you are yet. Set user.name and user.email, then commit.");
    case "detached":
      return t("HEAD is detached. Switch to a branch to push.");
    case "no_remote":
      return t("This repository has no remote to push to.");
    case "no_upstream":
      return t("This branch has no upstream to pull from. Push it first.");
    case "auth":
      return t("The remote refused the sign-in. Check your Git credentials.");
    case "rejected":
      return t("The remote has commits you do not have. Pull first, then push.");
    case "diverged":
      return t("Your branch and its upstream have diverged; pull cannot fast-forward.");
    case "offline":
      return t("Could not reach the remote. Check your connection.");
    case "timeout":
      return t(
        "The remote did not answer within 2 minutes, so Git was stopped. If it needs an SSH passphrase or a host key confirmation, answer that once in a terminal.",
      );
    default:
      return detail;
  }
}
