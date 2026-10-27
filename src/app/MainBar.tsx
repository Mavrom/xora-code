import { useRef, useState } from "react";
import {
  ArrowRightLeft,
  Copy,
  Download,
  Ellipsis,
  Files,
  PanelLeft,
  PanelRight,
  SquarePen,
} from "lucide-react";
import { selectActiveSession, useAgentStore } from "@/features/agents/store";
import { AgentGlyph } from "@/features/chat/AgentGlyph";
import { isDocked, sessionTitle } from "@/features/chat/sessionTitle";
import { useEditorStore } from "@/features/editor/store";
import { cn } from "@/shared/ui/cn";
import { ContextMenu } from "@/shared/ui/ContextMenu";
import { IconButton } from "@/shared/ui/IconButton";
import {
  copyChatMarkdown,
  exportChatMarkdown,
  handOffTo,
  handoffTargets,
} from "@/features/chat/exportChat";
import { SEPARATOR } from "@/shared/ui/menuModel";
import { toggleFiles, useUiStore } from "./uiStore";
import { NATIVE_CAPTION, TRAFFIC_LIGHT_INSET, WindowControls } from "./WindowControls";
import { t } from "@/shared/i18n";

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
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 pl-2",
          NATIVE_CAPTION && !sidebarOpen && TRAFFIC_LIGHT_INSET,
        )}
      >
        {!sidebarOpen && (
          <IconButton icon={PanelLeft} label={t("Show sidebar")} onClick={onShowSidebar} />
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
              label={t("New chat")}
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
              label={editorOpen ? t("Hide editor") : t("Show editor")}
              active={editorOpen}
              onClick={onToggleEditor}
            />
          )}
          <IconButton
            icon={Files}
            label={filesOpen ? t("Unpin files (Ctrl+Shift+E)") : t("Pin files (Ctrl+Shift+E)")}
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
  // Read when the menu opens: which other agents are signed in right now.
  const targets = at ? handoffTargets() : [];
  return (
    <>
      <span ref={anchor} className="inline-flex">
        <IconButton
          icon={Ellipsis}
          label={t("Chat options")}
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
              label: t("Copy as Markdown"),
              icon: Copy,
              onSelect: () => void copyChatMarkdown().catch(() => undefined),
            },
            {
              label: t("Export…"),
              icon: Download,
              hint: ".md",
              onSelect: () =>
                void exportChatMarkdown().catch((err: unknown) =>
                  console.error("chat export failed", err),
                ),
            },
            ...(targets.length > 0 ? [SEPARATOR] : []),
            ...targets.map((target) => ({
              label: t("Continue with {name}", { name: target.name }),
              icon: ArrowRightLeft,
              onSelect: () => void handOffTo(target.id),
            })),
          ]}
        />
      )}
    </>
  );
}
