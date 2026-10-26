import { Files, PanelLeft, PanelRight, SquarePen } from "lucide-react";
import { selectActiveSession, useAgentStore } from "@/features/agents/store";
import { AgentGlyph } from "@/features/chat/AgentGlyph";
import { isDocked, sessionTitle } from "@/features/chat/sessionTitle";
import { useEditorStore } from "@/features/editor/store";
import { cn } from "@/shared/ui/cn";
import { IconButton } from "@/shared/ui/IconButton";
import { toggleFiles, useUiStore } from "./uiStore";
import { WindowControls } from "./WindowControls";

interface MainBarProps {
  sidebarOpen: boolean;
  onShowSidebar: () => void;
  editorOpen: boolean;
  onToggleEditor: () => void;
}

/**
 * Top strip of the main area and the frameless window's drag handle. Over a new chat it
 * is invisible apart from the caption buttons, so the picture runs to the top edge; in a
 * conversation it carries the title.
 */
export function MainBar({ sidebarOpen, onShowSidebar, editorOpen, onToggleEditor }: MainBarProps) {
  const session = useAgentStore(selectActiveSession);
  const docked = isDocked(session);
  const title = docked ? sessionTitle(session) : null;
  const hasFiles = useEditorStore((s) => s.tabs.length > 0);
  const filesOpen = useUiStore((s) => s.filesOpen);

  return (
    <header
      data-tauri-drag-region="deep"
      className="relative flex h-10 shrink-0 items-center gap-2"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 pl-2">
        {!sidebarOpen && (
          <IconButton icon={PanelLeft} label="Kenar çubuğunu göster" onClick={onShowSidebar} />
        )}
        {docked && (
          <>
            <AgentGlyph
              agent={session.agentId}
              size={13}
              className={cn("shrink-0 text-fg-subtle", sidebarOpen && "ml-2")}
            />
            <h2 className="min-w-0 truncate text-xs text-fg-muted" title={title ?? undefined}>
              {title}
            </h2>
            <IconButton
              icon={SquarePen}
              label="Yeni sohbet"
              size="sm"
              onClick={() => useAgentStore.getState().setActiveSession(null)}
            />
          </>
        )}
      </div>
      <div className="flex h-full shrink-0 items-center">
        <div className="flex items-center gap-0.5 pr-1">
          {/* Only once there is a file to show; a new chat stays bare like the window frame. */}
          {hasFiles && (
            <IconButton
              icon={PanelRight}
              label={editorOpen ? "Editörü gizle" : "Editörü göster"}
              active={editorOpen}
              onClick={onToggleEditor}
            />
          )}
          <IconButton
            icon={Files}
            label={filesOpen ? "Dosyaları gizle (Ctrl+Shift+E)" : "Dosyaları göster (Ctrl+Shift+E)"}
            active={filesOpen}
            onClick={toggleFiles}
          />
        </div>
        <WindowControls />
      </div>
    </header>
  );
}
