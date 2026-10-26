import { useEffect, useRef, useState } from "react";
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
import { moveFocusOutOfEditor } from "@/features/editor/editorFocus";
import { InboxPanel } from "@/features/inbox/InboxPanel";
import { SessionList } from "@/features/chat/SessionList";
import { useEditorStore } from "@/features/editor/store";
import { TerminalDock } from "@/features/terminal/TerminalDock";
import { SettingsHost } from "@/features/settings/SettingsHost";
import { TopBar } from "./TopBar";
import { ActivityBar } from "./ActivityBar";
import { useUiStore } from "./uiStore";

/** 1px divider; the library widens the actual hit target around it. */
function ResizeHandle({ label }: { label: string }) {
  return (
    <Separator
      aria-label={label}
      className="w-px bg-border transition-colors duration-150 data-[separator=active]:bg-fg-muted data-[separator=focus]:bg-fg-subtle data-[separator=hover]:bg-fg-subtle"
    />
  );
}

function togglePanel(panel: PanelImperativeHandle | null) {
  if (!panel) return;
  if (panel.isCollapsed()) {
    panel.expand();
    return;
  }
  // Focus must not stay in a panel that is about to vanish (typing into a hidden file).
  moveFocusOutOfEditor();
  panel.collapse();
}

/** Share of the chat + editor area an auto-opened editor gets. */
const EDITOR_OPEN_SIZE = 45;

export function Layout() {
  const root = useWorkspaceStore((s) => s.root);
  const sidebarView = useUiStore((s) => s.sidebarView);
  const editorPanel = usePanelRef();
  const [editorOpen, setEditorOpen] = useState(true);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "xora-shell" });
  const center = useDefaultLayout({ id: "xora-center" });

  const activePath = useEditorStore((s) => s.activePath);
  const firstLayout = center.defaultLayout === undefined;

  const toggleEditor = () => togglePanel(editorPanel.current);

  // Minimal frame: the chat owns the window until there is a file to look at.
  useEffect(() => {
    if (firstLayout) editorPanel.current?.collapse();
  }, [firstLayout, editorPanel]);

  // Opening a file (from the tree, the palette or an agent's diff) reveals the editor.
  // The first file after an empty editor also gets a readable width; later opens keep
  // whatever width the user chose.
  const hadFile = useRef(activePath !== null);
  useEffect(() => {
    const panel = editorPanel.current;
    const first = !hadFile.current;
    hadFile.current = activePath !== null;
    if (!panel) return;
    if (!activePath) {
      // Closing the last tab hands the window back to the chat.
      if (!first && !panel.isCollapsed()) {
        moveFocusOutOfEditor();
        panel.collapse();
      }
      return;
    }
    if (panel.isCollapsed()) panel.expand();
    if (first && panel.getSize().asPercentage < EDITOR_OPEN_SIZE) {
      panel.resize(`${EDITOR_OPEN_SIZE}%`);
    }
  }, [activePath, editorPanel]);

  // The command palette asks for the toggle; the panel ref only exists here.
  useEffect(() => onCommand(TOGGLE_EDITOR, () => togglePanel(editorPanel.current)), [editorPanel]);

  return (
    // Grid: the top bar spans both columns; the activity bar sits left of the panels.
    <div className="grid h-full grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] [&>header]:col-span-2">
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
        // Pinned to the cell the settings page overlays; auto-placement would push it down.
        className="col-start-2 row-start-2 min-h-0"
      >
        <Panel id="files" defaultSize="18%" minSize="12%" className="glass-surface">
          {/* All stay mounted so switching views keeps tree expansion and drafts. */}
          <div className="h-full" hidden={sidebarView !== "sessions"}>
            <SessionList />
          </div>
          <div className="h-full" hidden={sidebarView !== "explorer"}>
            <FileTree onOpenFolder={openFolder} />
          </div>
          <div className="h-full" hidden={sidebarView !== "inbox"}>
            <InboxPanel />
          </div>
        </Panel>
        <ResizeHandle label="Kenar çubuğunu yeniden boyutlandır" />
        <Panel id="main" defaultSize="82%" minSize="50%">
          {/* The terminal docks under chat + editor; the sidebar keeps its full height. */}
          <TerminalDock>
            <Group
              id="xora-center"
              orientation="horizontal"
              defaultLayout={center.defaultLayout}
              onLayoutChanged={center.onLayoutChanged}
              className="h-full"
            >
              <Panel id="chat" defaultSize="51%" minSize="30%" className="glass-bg">
                <ChatPanel />
              </Panel>
              <ResizeHandle label="Editörü yeniden boyutlandır" />
              <Panel
                id="editor"
                panelRef={editorPanel}
                collapsible
                defaultSize="49%"
                minSize="24%"
                onResize={(size) => {
                  const open = size.asPercentage > 0;
                  // Dragged shut: same focus rescue as the toggle.
                  if (!open) moveFocusOutOfEditor();
                  setEditorOpen(open);
                }}
                className="glass-bg"
              >
                <EditorArea />
              </Panel>
            </Group>
          </TerminalDock>
        </Panel>
      </Group>
      {/* Settings page: overlays the panel area in the same grid cell while open. */}
      <SettingsHost />
    </div>
  );
}
