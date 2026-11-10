// Chat -> editor hand-offs. `openDiff` is package Q's editor store addition (design §5.3);
// it is feature-detected so the chat works before and after it lands.
import { ipc } from "@/shared/lib/ipc";
import { useEditorStore, type EditorRange } from "@/features/editor/store";

interface EditorExtras {
  openDiff?: (path: string, oldText: string | null, newText: string) => void;
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

/**
 * Opens `path` in the editor. With `at`, the editor then puts the cursor on that line or
 * selects that range (the editor panel applies it once the file shows).
 */
export function revealInEditor(path: string, at?: number | EditorRange | null): void {
  const { tabs, setActive, openFile, setReveal } = useEditorStore.getState();
  const range =
    typeof at === "number" ? { line: at, column: 1, endLine: at, endColumn: 1 } : (at ?? null);
  setReveal(range ? { path, range } : null);
  if (tabs.some((t) => t.path === path)) {
    setActive(path);
    return;
  }
  ipc.readFile(path).then(
    (content) => openFile(path, content),
    (err: unknown) => {
      if (useEditorStore.getState().reveal?.path === path) setReveal(null);
      console.warn("chat: could not open", path, err);
    },
  );
}
