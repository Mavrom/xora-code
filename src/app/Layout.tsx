import { useEffect, useRef, useState } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  usePanelRef,
  type PanelImperativeHandle,
} from "react-resizable-panels";
import { onCommand, TOGGLE_EDITOR } from "@/features/commands/events";
import { HeroBackdrop } from "@/features/backdrop/HeroBackdrop";
import { ChatPanel } from "@/features/chat/ChatPanel";
import { EditorArea } from "@/features/editor/EditorArea";
import { moveFocusOutOfEditor } from "@/features/editor/editorFocus";
import { useEditorStore } from "@/features/editor/store";
import { TerminalDock } from "@/features/terminal/TerminalDock";
import { SettingsHost } from "@/features/settings/SettingsHost";
import { FilesDrawer } from "./FilesDrawer";
import { MainBar } from "./MainBar";
import { Sidebar } from "./Sidebar";
import { cn } from "@/shared/ui/cn";

/**
 * 1px divider; the library widens the actual hit target around it. `quiet` ones (beside the
 * floating editor card) only show while hovered or dragged.
 */
function ResizeHandle({ label, quiet }: { label: string; quiet?: boolean }) {
  return (
    <Separator
      aria-label={label}
      className={cn(
        "w-px transition-colors duration-150 data-[separator=active]:bg-fg-muted data-[separator=focus]:bg-fg-subtle data-[separator=hover]:bg-fg-subtle",
        quiet ? "bg-transparent" : "bg-border",
      )}
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
  const sidebarPanel = usePanelRef();
  const editorPanel = usePanelRef();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editorOpen, setEditorOpen] = useState(true);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "xora-shell" });
  const center = useDefaultLayout({ id: "xora-center" });

  const activePath = useEditorStore((s) => s.activePath);
  const firstLayout = center.defaultLayout === undefined;

  // An empty editor is just a black slab: it only opens once a file is there to show.
  const toggleEditor = () => {
    if (useEditorStore.getState().tabs.length > 0) togglePanel(editorPanel.current);
  };

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
  useEffect(
    () =>
      onCommand(TOGGLE_EDITOR, () => {
        if (useEditorStore.getState().tabs.length > 0) togglePanel(editorPanel.current);
      }),
    [editorPanel],
  );

  return (
    <div className="relative h-full">
      <Group
        id="xora-shell"
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        className="h-full"
      >
        <Panel
          id="files"
          panelRef={sidebarPanel}
          collapsible
          defaultSize="256px"
          minSize="220px"
          maxSize="40%"
          onResize={(size) => setSidebarOpen(size.asPercentage > 0)}
        >
          <Sidebar onCollapse={() => sidebarPanel.current?.collapse()} />
        </Panel>
        <ResizeHandle label="Kenar çubuğunu yeniden boyutlandır" />
        <Panel id="main" defaultSize="82%" minSize="50%">
          <div className="relative isolate flex h-full flex-col">
            <HeroBackdrop />
            <MainBar
              sidebarOpen={sidebarOpen}
              onShowSidebar={() => sidebarPanel.current?.expand()}
              editorOpen={editorOpen}
              onToggleEditor={toggleEditor}
            />
            {/* The terminal docks under chat + editor; the sidebar keeps its full height. */}
            <div className="relative flex min-h-0 flex-1">
              <div className="relative min-w-0 flex-1">
                <TerminalDock>
                  <Group
                    id="xora-center"
                    orientation="horizontal"
                    defaultLayout={center.defaultLayout}
                    onLayoutChanged={center.onLayoutChanged}
                    className="h-full"
                  >
                    <Panel id="chat" defaultSize="51%" minSize="30%">
                      <ChatPanel />
                    </Panel>
                    <ResizeHandle label="Editörü yeniden boyutlandır" quiet />
                    <Panel
                      id="editor"
                      panelRef={editorPanel}
                      collapsible
                      defaultSize="49%"
                      minSize="24%"
                      onResize={(size) => {
                        const open = size.asPercentage > 0;
                        // Nothing to show: an editor dragged open without a file folds back.
                        if (open && useEditorStore.getState().tabs.length === 0) {
                          editorPanel.current?.collapse();
                          return;
                        }
                        // Dragged shut: same focus rescue as the toggle.
                        if (!open) moveFocusOutOfEditor();
                        setEditorOpen(open);
                      }}
                    >
                      {/* A card floating over the picture, not a slab cut out of it. */}
                      <div className="h-full pr-2 pb-2 pl-1">
                        <div className="h-full overflow-hidden rounded-xl border border-white/[0.07] bg-[#0b0b0c]/95 shadow-[0_12px_40px_rgb(0_0_0/0.5),inset_0_1px_0_rgb(255_255_255/0.04)] backdrop-blur-xl">
                          <EditorArea />
                        </div>
                      </div>
                    </Panel>
                  </Group>
                </TerminalDock>
              </div>
              <FilesDrawer />
            </div>
          </div>
        </Panel>
      </Group>
      {/* Settings page: covers the whole window while open. */}
      <SettingsHost />
    </div>
  );
}
