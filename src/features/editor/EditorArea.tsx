import { lazy, Suspense } from "react";
import { FileCode } from "lucide-react";
import { EmptyState } from "@/shared/ui/EmptyState";
import { EDITOR_EMPTY_ID } from "./editorKeys";
import { EditorStatusBar } from "./EditorStatusBar";
import { EditorTabs } from "./EditorTabs";
import { useEditorStore } from "./store";

// Monaco is several MB: it is only fetched once the first file is opened.
const EditorPanel = lazy(() => import("./EditorPanel").then((m) => ({ default: m.EditorPanel })));

/** Editor slot: a light empty state until a tab exists, then the lazy Monaco panel. */
export function EditorArea() {
  const hasTabs = useEditorStore((s) => s.tabs.length > 0);

  if (!hasTabs) {
    // Focusable (not tabbable) so closing the last tab can park focus here.
    return (
      <div
        id={EDITOR_EMPTY_ID}
        tabIndex={-1}
        role="region"
        aria-label="Editör"
        className="h-full outline-none"
      >
        <EmptyState
          icon={FileCode}
          title="Açık dosya yok"
          description="Explorer'dan bir dosya seç."
        />
      </div>
    );
  }

  return (
    <Suspense fallback={<EditorShell />}>
      <EditorPanel />
    </Suspense>
  );
}

/** Same chrome as the loaded panel, so Monaco arriving causes no layout shift. */
function EditorShell() {
  const activePath = useEditorStore((s) => s.activePath);
  return (
    <div className="flex h-full flex-col bg-bg">
      <EditorTabs />
      <div className="min-h-0 flex-1" />
      <EditorStatusBar path={activePath} />
    </div>
  );
}
