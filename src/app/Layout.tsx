import { useEffect, useState } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  usePanelRef,
  type PanelImperativeHandle,
} from "react-resizable-panels";
import { basename } from "@/shared/lib/path";
import { useWorkspaceStore } from "@/features/workspace/store";
import { openFolder } from "@/features/workspace/openFolder";
import { onCommand, TOGGLE_EDITOR } from "@/features/commands/events";
import { FileTree } from "@/features/files/FileTree";
import { ChatPanel } from "@/features/chat/ChatPanel";
import { EditorArea } from "@/features/editor/EditorArea";
import { InboxPanel } from "@/features/inbox/InboxPanel";
import { TerminalDock } from "@/features/terminal/TerminalDock";
import { TopBar } from "./TopBar";
import { ActivityBar } from "./ActivityBar";
import { useUiStore } from "./uiStore";

/** 1px divider; the library widens the actual hit target around it. */
function ResizeHandle() {
  return (
    <Separator className="w-px bg-border transition-colors duration-150 data-[separator=active]:bg-fg-muted data-[separator=focus]:bg-fg-subtle data-[separator=hover]:bg-fg-subtle" />
  );
}

function togglePanel(panel: PanelImperativeHandle | null) {
  if (!panel) return;
  if (panel.isCollapsed()) panel.expand();
  else panel.collapse();
}

export function Layout() {
  const root = useWorkspaceStore((s) => s.root);
  const sidebarView = useUiStore((s) => s.sidebarView);
  const editorPanel = usePanelRef();
  const [editorOpen, setEditorOpen] = useState(true);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "xora-shell" });
  const center = useDefaultLayout({ id: "xora-center" });

  const toggleEditor = () => togglePanel(editorPanel.current);

  // The command palette asks for the toggle; the panel ref only exists here.
  useEffect(() => onCommand(TOGGLE_EDITOR, () => togglePanel(editorPanel.current)), [editorPanel]);

  return (
    // Grid: the top bar spans both columns; the activity bar sits left of the panels.
    <div className="grid h-full grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] bg-bg [&>header]:col-span-2">
      <TopBar
        folderName={root ? basename(root) : null}
        editorOpen={editorOpen}
        onOpenFolder={openFolder}
        onToggleEditor={toggleEditor}
      />
      <ActivityBar />
      <Group
        id="xora-shell"
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        className="min-h-0 flex-1"
      >
        <Panel id="files" defaultSize="18%" minSize="12%" className="bg-surface">
          {/* Both stay mounted so switching views keeps tree expansion and drafts. */}
          <div className="h-full" hidden={sidebarView !== "explorer"}>
            <FileTree onOpenFolder={openFolder} />
          </div>
          <div className="h-full" hidden={sidebarView !== "inbox"}>
            <InboxPanel />
          </div>
        </Panel>
        <ResizeHandle />
        <Panel id="main" defaultSize="82%" minSize="50%" className="bg-bg">
          {/* The terminal docks under chat + editor; the sidebar keeps its full height. */}
          <TerminalDock>
            <Group
              id="xora-center"
              orientation="horizontal"
              defaultLayout={center.defaultLayout}
              onLayoutChanged={center.onLayoutChanged}
              className="h-full"
            >
              <Panel id="chat" defaultSize="51%" minSize="30%" className="bg-bg">
                <ChatPanel />
              </Panel>
              <ResizeHandle />
              <Panel
                id="editor"
                panelRef={editorPanel}
                collapsible
                defaultSize="49%"
                minSize="24%"
                onResize={(size) => setEditorOpen(size.asPercentage > 0)}
                className="bg-surface"
              >
                <EditorArea />
              </Panel>
            </Group>
          </TerminalDock>
        </Panel>
      </Group>
    </div>
  );
}
