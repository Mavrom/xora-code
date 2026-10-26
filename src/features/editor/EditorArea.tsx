import { lazy, Suspense } from "react";
import { FileCode } from "lucide-react";
import { EmptyState } from "@/shared/ui/EmptyState";
import { useDiskSync } from "./diskSync";
import { EDITOR_EMPTY_ID } from "./editorKeys";
import { EditorStatusBar } from "./EditorStatusBar";
import { EditorTabs } from "./EditorTabs";
import { useEditorStore } from "./store";

// Monaco is several MB: it is only fetched once the first file is opened.
const EditorPanel = lazy(() => import("./EditorPanel").then((m) => ({ default: m.EditorPanel })));

/** Editor slot: a light empty state until a tab exists, then the lazy Monaco panel. */
export function EditorArea() {
  const hasTabs = useEditorStore((s) => s.tabs.length > 0);
  useDiskSync();

  if (!hasTabs) {
    // Focusable (not tabbable) so closing the last tab can park focus here. The empty
    // strip where tabs would be keeps the well level with the files column (same 40px header).
    return (
      <div
        id={EDITOR_EMPTY_ID}
        tabIndex={-1}
        role="region"
        aria-label="Editör"
        data-editor-area
        className="flex h-full flex-col outline-none"
      >
        <div aria-hidden className="h-10 shrink-0" />
        <div className="min-h-0 flex-1">
          <EmptyState
            icon={FileCode}
            title="Açık dosya yok"
            description="Dosyalar panelinden bir dosya seç."
          />
        </div>
      </div>
    );
  }

  return (
    <div data-editor-area className="h-full">
      <Suspense fallback={<EditorShell />}>
        <EditorPanel />
      </Suspense>
    </div>
  );
}

/** Same chrome as the loaded panel, so Monaco arriving causes no layout shift. */
function EditorShell() {
  const activePath = useEditorStore((s) => s.activePath);
  return (
    <div className="flex h-full flex-col">
      <EditorTabs />
      <div className="min-h-0 flex-1" />
      <EditorStatusBar path={activePath} />
    </div>
  );
}
