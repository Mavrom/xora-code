import { useMemo, type KeyboardEvent } from "react";
import { CircleCheck, FolderGit2, FolderOpen, RotateCw } from "lucide-react";
import { openFolder } from "@/features/workspace/openFolder";
import { EmptyState } from "@/shared/ui/EmptyState";
import { IconButton } from "@/shared/ui/IconButton";
import { PanelHeader, type PanelBack } from "@/shared/ui/PanelHeader";
import { BranchBar } from "./BranchBar";
import { ChangeGroup } from "./ChangeGroup";
import { groupChanges } from "./changes";
import { noticeUnderBranch, useChangesStore } from "./changesStore";
import { ChangesNotice } from "./ChangesNotice";
import { CommitBox } from "./CommitBox";
import type { GitStatus } from "./ipc";
import { TurnGroup } from "./TurnGroup";
import { t } from "@/shared/i18n";

/** Focus target when the view is opened from the keyboard (Ctrl+Shift+G). */
export const CHANGES_PANEL_ID = "changes-panel";

/**
 * The Changes view: the active checkout's branch with Pull / Push, a commit message, and
 * its staged and unstaged files, each unfolding to a diff. `back` puts a way out before the
 * title (the sidebar shows it in place of the chats).
 */
export function ChangesPanel({ back }: { back?: PanelBack } = {}) {
  const status = useChangesStore((s) => s.status);
  const problem = useChangesStore((s) => s.problem);
  const error = useChangesStore((s) => s.error);
  const loading = useChangesStore((s) => s.loading);
  const dir = useChangesStore((s) => s.dir);
  const refresh = () => void useChangesStore.getState().refresh();

  return (
    <div
      id={CHANGES_PANEL_ID}
      tabIndex={-1}
      aria-busy={loading}
      className="flex h-full flex-col outline-none"
    >
      <PanelHeader
        title={t("Changes")}
        back={back}
        actions={
          dir ? (
            <IconButton size="sm" icon={RotateCw} label={t("Refresh")} onClick={refresh} />
          ) : undefined
        }
      />
      {!noticeUnderBranch({ status, problem }) && <ChangesNotice className="mx-2.5 mb-2" />}
      {problem === "no_folder" ? (
        <EmptyState
          icon={FolderOpen}
          title={t("No folder open")}
          description={t("Open a folder to see its changes and commit them.")}
          action={{ label: t("Open folder"), icon: FolderOpen, onClick: () => void openFolder() }}
        />
      ) : problem === "not_repo" ? (
        <>
          <TurnOnly />
          <EmptyState
            icon={FolderGit2}
            title={t("Not a git repository")}
            description={t("This folder is not under Git version control.")}
          />
        </>
      ) : problem === "error" ? (
        <EmptyState
          icon={FolderGit2}
          title={t("Could not read the changes")}
          description={error ?? undefined}
          action={{ label: t("Retry"), icon: RotateCw, onClick: refresh }}
        />
      ) : status ? (
        <Loaded key={dir} status={status} />
      ) : (
        <p className="px-3.5 py-2 text-2xs text-fg-subtle">{t("Reading changes…")}</p>
      )}
    </div>
  );
}

/** The turn's files alone, for a folder git cannot show (the agent's edits still count). */
function TurnOnly() {
  const dir = useChangesStore((s) => s.dir);
  return (
    <div className="shrink-0 px-1.5">
      <TurnGroup root={dir} />
    </div>
  );
}

/** Up/Down walk the file rows of every group. */
function onListKeyDown(e: KeyboardEvent<HTMLDivElement>) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const rows = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-change-row]")];
  const index = rows.indexOf(document.activeElement as HTMLElement);
  if (index === -1) return;
  const next = rows[e.key === "ArrowDown" ? index + 1 : index - 1];
  if (next) {
    e.preventDefault();
    next.focus();
  }
}

function Loaded({ status }: { status: GitStatus }) {
  const { staged, changes } = useMemo(() => groupChanges(status.entries), [status.entries]);

  return (
    <>
      <BranchBar status={status} />
      <CommitBox />
      <div aria-hidden className="mx-4 mb-1 h-px shrink-0 bg-white/[0.05]" />
      <div
        data-change-list
        tabIndex={-1}
        onKeyDown={onListKeyDown}
        className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-1.5 pb-3 outline-none [scrollbar-width:thin]"
      >
        <TurnGroup root={status.root} />
        {status.entries.length === 0 ? (
          <EmptyState
            icon={CircleCheck}
            title={t("No changes")}
            description={t("The working tree matches the last commit.")}
          />
        ) : (
          <>
            <ChangeGroup title={t("Staged")} rows={staged} staged root={status.root} />
            <ChangeGroup title={t("Changes")} rows={changes} staged={false} root={status.root} />
            {status.truncated && (
              <p className="px-2.5 pt-2 text-2xs text-fg-subtle">
                {t("Only the first {n} changed files are listed.", { n: status.entries.length })}
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
