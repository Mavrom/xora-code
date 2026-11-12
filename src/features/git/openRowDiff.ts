// "Open diff" on a Changes row: both sides of the row's change, read from git or disk,
// shown in the editor's diff tab for that file.
import { ipc } from "@/shared/lib/ipc";
import { openDiffInEditor } from "@/features/chat/editorBridge";
import { diffSides, filePath, type ChangeRow, type DiffSide } from "./changes";
import { gitIpc } from "./ipc";

/**
 * Reads the row's two sides and opens them as a diff tab. Rejects with the `[code]` error
 * of the failing read (e.g. `[binary]`), opening nothing.
 */
export async function openRowDiff(dir: string, root: string, row: ChangeRow): Promise<void> {
  const file = filePath(root, row.path);
  const read = (side: DiffSide): Promise<string | null> =>
    side.from === "git"
      ? gitIpc.show(dir, side.path, side.rev)
      : side.from === "disk"
        ? ipc.readFile(file)
        : Promise.resolve(null);
  const { left, right } = diffSides(row);
  const [oldText, newText] = await Promise.all([read(left), read(right)]);
  openDiffInEditor(file, oldText, newText ?? "");
}
