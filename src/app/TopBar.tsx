import { FolderOpen, PanelRight } from "lucide-react";
import { IconButton } from "@/shared/ui/IconButton";

interface TopBarProps {
  folderName: string | null;
  editorOpen: boolean;
  onOpenFolder: () => void;
  onToggleEditor: () => void;
}

export function TopBar({ folderName, editorOpen, onOpenFolder, onToggleEditor }: TopBarProps) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-bg pr-2 pl-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-[13px] font-semibold tracking-tight text-fg">Xora</span>
        {folderName && (
          <>
            <span className="h-3.5 w-px shrink-0 bg-border-strong" aria-hidden />
            <span className="truncate text-[13px] text-fg-muted">{folderName}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-0.5">
        <IconButton icon={FolderOpen} label="Klasör aç" onClick={onOpenFolder} />
        <IconButton
          icon={PanelRight}
          label={editorOpen ? "Editörü gizle" : "Editörü göster"}
          active={editorOpen}
          onClick={onToggleEditor}
        />
      </div>
    </header>
  );
}
