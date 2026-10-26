import { FolderOpen, PanelRight } from "lucide-react";
import { IconButton } from "@/shared/ui/IconButton";
import { WindowControls } from "./WindowControls";

interface TopBarProps {
  folderName: string | null;
  editorOpen: boolean;
  onOpenFolder: () => void;
  onToggleEditor: () => void;
}

/**
 * Xora mark: the app icon inverted into a light tile (a bare X would read as a close
 * button). One full diagonal, the other passing under it; same geometry as assets/brand.
 */
function XoraMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-hidden>
      <rect width="16" height="16" rx="4" className="fill-fg" />
      <g fill="none" strokeWidth={2} className="stroke-bg">
        <path d="M4.25 4.25 11.75 11.75" />
        <path d="M11.75 4.25 9.5 6.5M6.5 9.5 4.25 11.75" />
      </g>
    </svg>
  );
}

/**
 * Custom title bar for the frameless window. The whole bar is a deep drag region:
 * buttons opt out automatically, double-click on empty space toggles maximize.
 */
export function TopBar({ folderName, editorOpen, onOpenFolder, onToggleEditor }: TopBarProps) {
  return (
    <header
      data-tauri-drag-region="deep"
      className="flex h-10 shrink-0 items-center justify-between border-b border-border glass-bg pl-3.5"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <XoraMark />
        <span className="text-[13px] font-semibold tracking-tight text-fg">Xora</span>
        {folderName && (
          <>
            <span className="h-3.5 w-px shrink-0 bg-border-strong" aria-hidden />
            <span className="truncate text-[13px] text-fg-muted">{folderName}</span>
          </>
        )}
      </div>
      <div className="flex h-full items-center">
        <div className="flex items-center gap-0.5 pr-2">
          <IconButton icon={FolderOpen} label="Klasör aç" onClick={onOpenFolder} />
          <IconButton
            icon={PanelRight}
            label={editorOpen ? "Editörü gizle" : "Editörü göster"}
            active={editorOpen}
            onClick={onToggleEditor}
          />
        </div>
        <span className="h-4 w-px shrink-0 bg-border-strong" aria-hidden />
        <WindowControls />
      </div>
    </header>
  );
}
