// Chat -> editor hand-offs.
import { ipc } from "@/shared/lib/ipc";
import { useEditorStore, type EditorRange } from "@/features/editor/store";

/**
 * Opens a proposed or applied change of `path` as a read-only Monaco diff tab (`oldText`
 * null: a new file). Opening it again for the same file refreshes that tab.
 */
export function openDiffInEditor(path: string, oldText: string | null, newText: string): void {
  useEditorStore.getState().openDiff(path, oldText, newText);
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
