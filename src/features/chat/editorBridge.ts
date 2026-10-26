// Chat -> editor hand-offs. `openDiff` and `revealLocation` are package Q's editor store
// additions (design §5.3); they are feature-detected so the chat works before and after
// they land, falling back to a plain open.
import { ipc } from "@/shared/lib/ipc";
import { useEditorStore } from "@/features/editor/store";

interface EditorExtras {
  openDiff?: (path: string, oldText: string | null, newText: string) => void;
  revealLocation?: (path: string, line?: number | null) => void;
}

const extras = () => useEditorStore.getState() as unknown as EditorExtras;

/** Whether the editor can show a side-by-side diff. */
export function canOpenDiff(): boolean {
  return typeof extras().openDiff === "function";
}

/** Opens a Monaco diff for a proposed or applied change; returns false when unsupported. */
export function openDiffInEditor(path: string, oldText: string | null, newText: string): boolean {
  const openDiff = extras().openDiff;
  if (!openDiff) return false;
  openDiff(path, oldText, newText);
  return true;
}

/** Opens `path` in the editor, at `line` when the editor supports it. */
export function revealInEditor(path: string, line?: number | null): void {
  const reveal = extras().revealLocation;
  if (reveal) {
    reveal(path, line);
    return;
  }
  const { tabs, setActive, openFile } = useEditorStore.getState();
  if (tabs.some((t) => t.path === path)) {
    setActive(path);
    return;
  }
  ipc.readFile(path).then(
    (content) => openFile(path, content),
    (err: unknown) => console.warn("chat: could not open", path, err),
  );
}
