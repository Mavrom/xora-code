import { useCallback, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from "react-resizable-panels";
import { basename } from "@/shared/lib/path";
import { useWorkspaceStore } from "@/features/workspace/store";
import { FileTree } from "@/features/files/FileTree";
import { ChatPanel } from "@/features/chat/ChatPanel";
import { EditorArea } from "@/features/editor/EditorArea";
import { InboxPanel } from "@/features/inbox/InboxPanel";
import { TopBar } from "./TopBar";
import { ActivityBar } from "./ActivityBar";
import { useUiStore } from "./uiStore";

/** 1px divider; the library widens the actual hit target around it. */
function ResizeHandle() {
  return (
    <Separator className="w-px bg-border transition-colors duration-150 data-[separator=active]:bg-fg-muted data-[separator=focus]:bg-fg-subtle data-[separator=hover]:bg-fg-subtle" />
  );
}

export function Layout() {
  const root = useWorkspaceStore((s) => s.root);
  const setRoot = useWorkspaceStore((s) => s.setRoot);
  const sidebarView = useUiStore((s) => s.sidebarView);
  const editorPanel = usePanelRef();
  const [editorOpen, setEditorOpen] = useState(true);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "xora-layout" });

  const openFolder = useCallback(async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string") setRoot(selected);
    } catch (error) {
      console.error("Failed to open folder dialog", error);
    }
  }, [setRoot]);

  const toggleEditor = () => {
    const panel = editorPanel.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  };

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
        id="xora-layout"
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
        <Panel id="chat" defaultSize="42%" minSize="25%" className="bg-bg">
          <ChatPanel />
        </Panel>
        <ResizeHandle />
        <Panel
          id="editor"
          panelRef={editorPanel}
          collapsible
          defaultSize="40%"
          minSize="20%"
          onResize={(size) => setEditorOpen(size.asPercentage > 0)}
          className="bg-surface"
        >
          <EditorArea />
        </Panel>
      </Group>
    </div>
  );
}
