// A turn's changed files (`SessionView.changes`): their summed line counts and how one opens.
import type { ReviewChange } from "@/features/agents/reducer";
import { diffLines, diffStats } from "./diff";
import { openDiffInEditor, revealInEditor } from "./editorBridge";

/** "+12 −4" over every change whose two sides are known. */
export function totalStats(changes: readonly ReviewChange[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const c of changes) {
    if (c.oldText === undefined || c.newText === undefined) continue;
    const s = diffStats(diffLines(c.oldText, c.newText));
    added += s.added;
    removed += s.removed;
  }
  return { added, removed };
}

/**
 * Opens the change as a diff tab when both sides are known (an unknown old side would show
 * the whole file as added), else the file itself.
 */
export function openTurnChange({ path, oldText, newText }: ReviewChange): void {
  if (oldText === undefined || newText === undefined) revealInEditor(path);
  else openDiffInEditor(path, oldText, newText);
}
