// The Review panel's one list: this turn's agent changes first, then the rest of the
// working tree's uncommitted changes (git status), without listing a file twice. Pure.
import type { ReviewChange } from "@/features/agents/reducer";
import { filePath, groupChanges, type ChangeRow } from "@/features/git/changes";
import type { GitStatus } from "@/features/git/ipc";

/** What the panel shows below its list: one agent change, or one git row. */
export type ReviewSelection =
  { kind: "turn"; path: string } | { kind: "git"; path: string; staged: boolean };

export interface ReviewSections {
  /** The agent's changes since the last Accept (absolute paths). */
  turn: ReviewChange[];
  /** Git rows staged in the index. */
  staged: ChangeRow[];
  /** Git rows in the working tree that are not already listed as this turn's changes. */
  changes: ChangeRow[];
  /** Distinct files across all three. */
  count: number;
}

/**
 * A comparable spelling of an absolute path: forward slashes, no trailing slash, and on a
 * Windows drive path case folded (git spells roots "C:/repo", the agents "C:\repo").
 */
export function pathKey(path: string): string {
  const slashed = path.replace(/\\/g, "/").replace(/\/+$/, "");
  return /^[A-Za-z]:\//.test(slashed) ? slashed.toLowerCase() : slashed;
}

/**
 * Splits what to review into the turn's changes and the other uncommitted ones. A working
 * tree row for a file the agent changed this turn is that same change, so it is left out;
 * a staged row of it stays (that is what the user already put in the index).
 */
export function reviewSections(
  turn: readonly ReviewChange[],
  status: GitStatus | null,
): ReviewSections {
  const turnKeys = new Set(turn.map((c) => pathKey(c.path)));
  const groups = status ? groupChanges(status.entries) : { staged: [], changes: [] };
  const key = (row: ChangeRow) => (status ? pathKey(filePath(status.root, row.path)) : row.path);
  const changes = groups.changes.filter((row) => !turnKeys.has(key(row)));
  const files = new Set([...turnKeys, ...groups.staged.map(key), ...changes.map(key)]);
  return { turn: [...turn], staged: groups.staged, changes, count: files.size };
}

/** Whether `selection` still names something in `sections`. */
export function selectionExists(sections: ReviewSections, selection: ReviewSelection): boolean {
  if (selection.kind === "turn") return sections.turn.some((c) => c.path === selection.path);
  const rows = selection.staged ? sections.staged : sections.changes;
  return rows.some((r) => r.path === selection.path);
}

/** The selection to show: the given one while it exists, else the first file listed. */
export function effectiveSelection(
  sections: ReviewSections,
  selection: ReviewSelection | null,
): ReviewSelection | null {
  if (selection && selectionExists(sections, selection)) return selection;
  if (sections.turn[0]) return { kind: "turn", path: sections.turn[0].path };
  const row = sections.staged[0] ?? sections.changes[0];
  return row ? { kind: "git", path: row.path, staged: row.staged } : null;
}

/** The selection for an absolute file path, if the panel lists that file. */
export function selectionForFile(
  sections: ReviewSections,
  root: string | null,
  file: string,
): ReviewSelection | null {
  const want = pathKey(file);
  const change = sections.turn.find((c) => pathKey(c.path) === want);
  if (change) return { kind: "turn", path: change.path };
  if (!root) return null;
  const row = [...sections.changes, ...sections.staged].find(
    (r) => pathKey(filePath(root, r.path)) === want,
  );
  return row ? { kind: "git", path: row.path, staged: row.staged } : null;
}
