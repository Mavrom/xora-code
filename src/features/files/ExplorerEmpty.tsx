import { useId, useState } from "react";
import { Folder, FolderOpen, FolderSearch } from "lucide-react";
import { basename } from "@/shared/lib/path";
import { openRecent } from "@/features/workspace/openFolder";
import { parentLabel } from "@/features/workspace/recents";
import { useWorkspaceStore } from "@/features/workspace/store";
import { Button } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { t } from "@/shared/i18n";

/** "Klasör açılmadı" plus the recently opened folders, newest first. */
export function ExplorerEmpty({ onOpenFolder }: { onOpenFolder: () => void }) {
  const recents = useWorkspaceStore((s) => s.recents);
  const [gone, setGone] = useState<string | null>(null);
  const headingId = useId();

  const reopen = async (path: string) => {
    setGone(null);
    if (!(await openRecent(path))) setGone(basename(path));
  };

  return (
    <EmptyState
      icon={FolderSearch}
      title={t("No folder open")}
      description={
        recents.length > 0
          ? t("Open a folder or pick up where you left off.")
          : t("Open a folder to get started.")
      }
      action={
        <>
          <Button icon={FolderOpen} onClick={onOpenFolder}>
            {t("Open folder")}
          </Button>
          {recents.length > 0 && (
            <section aria-labelledby={headingId} className="mt-7 w-full max-w-64 text-left">
              <h3
                id={headingId}
                className="px-2 pb-1.5 text-2xs font-medium tracking-wide text-fg-subtle uppercase"
              >
                {t("Recent")}
              </h3>
              <ul className="flex flex-col">
                {recents.map((path) => (
                  <li key={path}>
                    <button
                      type="button"
                      title={path}
                      onClick={() => void reopen(path)}
                      className="group flex h-7 w-full min-w-0 items-center gap-2 rounded-sm px-2 text-xs transition-colors duration-fast hover:bg-hover"
                    >
                      <Folder
                        size={13}
                        strokeWidth={1.75}
                        aria-hidden
                        className="shrink-0 text-fg-subtle"
                      />
                      <span className="shrink-0 truncate text-fg-muted group-hover:text-fg">
                        {basename(path)}
                      </span>
                      <span className="min-w-0 truncate text-2xs text-fg-subtle">
                        {parentLabel(path)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p role="status" className="min-h-5 px-2 pt-1 text-2xs text-fg-subtle">
                {gone && t("“{gone}” was not found and was removed from the list.", { gone })}
              </p>
            </section>
          )}
        </>
      }
    />
  );
}
