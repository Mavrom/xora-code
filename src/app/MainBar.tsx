import { useRef, useState } from "react";
import { Copy, Download, Ellipsis, Files, PanelLeft, PanelRight, SquarePen } from "lucide-react";
import { selectActiveSession, useAgentStore } from "@/features/agents/store";
import { AgentGlyph } from "@/features/chat/AgentGlyph";
import { isDocked, sessionTitle } from "@/features/chat/sessionTitle";
import { useEditorStore } from "@/features/editor/store";
import { cn } from "@/shared/ui/cn";
import { ContextMenu } from "@/shared/ui/ContextMenu";
import { IconButton } from "@/shared/ui/IconButton";
import { copyChatMarkdown, exportChatMarkdown } from "@/features/chat/exportChat";
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
  // A name the user gave the conversation wins over the agent's title.
  const customTitle = useAgentStore((s) =>
    session
      ? s.history.find((h) => h.agentId === session.agentId && h.sessionId === session.sessionId)
          ?.customTitle
      : null,
  );
  const title = docked ? customTitle || sessionTitle(session) : null;
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
            <ChatMenu title={title ?? ""} />
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
            label={
              filesOpen
                ? "Dosyaları sabitlemeyi bırak (Ctrl+Shift+E)"
                : "Dosyaları sabitle (Ctrl+Shift+E)"
            }
            active={filesOpen}
            onClick={toggleFiles}
          />
        </div>
        <WindowControls />
      </div>
    </header>
  );
}

/** The conversation's own actions, next to its title. */
function ChatMenu({ title }: { title: string }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  return (
    <>
      <span ref={anchor} className="inline-flex">
        <IconButton
          icon={Ellipsis}
          label="Sohbet seçenekleri"
          size="sm"
          onClick={() => {
            const r = anchor.current?.getBoundingClientRect();
            if (r) setAt({ x: r.left, y: r.bottom + 4 });
          }}
        />
      </span>
      {at && (
        <ContextMenu
          x={at.x}
          y={at.y}
          label={title}
          onClose={() => setAt(null)}
          items={[
            {
              label: "Markdown olarak kopyala",
              icon: Copy,
              onSelect: () => void copyChatMarkdown().catch(() => undefined),
            },
            {
              label: "Dışa aktar…",
              icon: Download,
              hint: ".md",
              onSelect: () =>
                void exportChatMarkdown().catch((err: unknown) =>
                  console.error("chat export failed", err),
                ),
            },
          ]}
        />
      )}
    </>
  );
}
