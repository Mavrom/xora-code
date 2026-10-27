import { Folder, FolderOpen, Plus, RotateCw, X } from "lucide-react";
import { basename } from "@/shared/lib/path";
import { requestRefresh } from "@/features/workspace/fsWatch";
import { openRecent } from "@/features/workspace/openFolder";
import { samePath } from "@/features/workspace/recents";
import { useWorkspaceStore } from "@/features/workspace/store";
import { cn } from "@/shared/ui/cn";
import { IconButton } from "@/shared/ui/IconButton";
import { t } from "@/shared/i18n";

/**
 * Header of the file tree: the open folders side by side (click one to show its tree),
 * then + to add another and a refresh for the one shown.
 */
export function FolderTabs({ onAdd }: { onAdd: () => void }) {
  const root = useWorkspaceStore((s) => s.root);
  const folders = useWorkspaceStore((s) => s.folders);

  const show = (path: string) => {
    if (root && samePath(root, path)) return;
    // A folder that is gone loses its tab too.
    void openRecent(path).then((ok) => {
      if (!ok) useWorkspaceStore.getState().closeFolder(path);
    });
  };

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b border-white/[0.05] pr-1 pl-1.5">
      <div
        role="tablist"
        aria-label={t("Open folders")}
        // A vertical wheel scrolls the strip sideways, like the editor's tabs.
        onWheel={(e) => {
          if (e.deltaY !== 0 && e.deltaX === 0) e.currentTarget.scrollLeft += e.deltaY;
        }}
        className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {folders.map((path) => {
          const active = !!root && samePath(root, path);
          const name = basename(path);
          const Icon = active ? FolderOpen : Folder;
          return (
            <div
              key={path}
              className={cn(
                "group flex h-7 max-w-40 shrink-0 items-center rounded-md transition-colors duration-fast",
                active
                  ? "bg-white/[0.07] text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]"
                  : "text-fg-muted hover:bg-white/[0.035] hover:text-fg",
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                title={path}
                onClick={() => show(path)}
                className="flex h-full min-w-0 items-center gap-1.5 rounded-md pr-1 pl-2 text-xs outline-none focus-visible:bg-hover"
              >
                <Icon size={13} strokeWidth={1.75} className="shrink-0 opacity-70" aria-hidden />
                <span className="truncate">{name}</span>
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-label={t("Close folder {name}", { name })}
                title={t("Close")}
                onClick={() => useWorkspaceStore.getState().closeFolder(path)}
                className={cn(
                  "mr-1 grid size-4.5 shrink-0 place-items-center rounded-sm text-fg-subtle transition-colors duration-fast hover:bg-elevated hover:text-fg",
                  !active && "opacity-0 group-hover:opacity-100",
                )}
              >
                <X size={12} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
      <IconButton icon={Plus} size="sm" label={t("Add folder")} onClick={onAdd} />
      {root && (
        <IconButton
          icon={RotateCw}
          size="sm"
          label={t("Refresh")}
          onClick={() => requestRefresh()}
        />
      )}
    </div>
  );
}
