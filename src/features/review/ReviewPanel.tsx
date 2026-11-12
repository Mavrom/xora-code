import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Check, CircleCheck, FolderGit2, RotateCw, Undo2, X } from "lucide-react";
import { errorMessage } from "@/features/agents/ipc";
import type { ReviewChange } from "@/features/agents/reducer";
import { selectActiveSession, useAgentStore } from "@/features/agents/store";
import { DiffStat } from "@/features/chat/DiffPreview";
import { diffLines, diffStats } from "@/features/chat/diff";
import { FileIcon } from "@/features/files/FileIcon";
import { BranchBar } from "@/features/git/BranchBar";
import { ChangeGroup } from "@/features/git/ChangeGroup";
import { describeChangesError, splitPath, type ChangeRow } from "@/features/git/changes";
import { useChangesStore } from "@/features/git/changesStore";
import { CommitBox } from "@/features/git/CommitBox";
import { readRowDiff, type RowDiff } from "@/features/git/openRowDiff";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/ui/cn";
import { EmptyState } from "@/shared/ui/EmptyState";
import { IconButton } from "@/shared/ui/IconButton";
import { t } from "@/shared/i18n";
import { effectiveSelection, pathKey, type ReviewSelection } from "./reviewList";
import { REVIEW_PANEL_ID, useReviewSections, useReviewStore } from "./store";

// Monaco (and its setup) arrives with the first diff, as it does for the editor.
const ReviewDiff = lazy(() => import("./ReviewDiff"));

/**
 * One place to review changes, in the card where the editor lives: the files (this turn's
 * first, then the rest of the working tree), the selected file's diff, and the commit box
 * with Pull / Push. Per file: Revert for the agent's changes, stage / discard for git rows.
 */
export function ReviewPanel() {
  const sections = useReviewSections();
  const selected = useReviewStore((s) => s.selected);
  const current = effectiveSelection(sections, selected);
  const status = useChangesStore((s) => s.status);
  const problem = useChangesStore((s) => s.problem);
  const dir = useChangesStore((s) => s.dir);
  const select = (next: ReviewSelection) => useReviewStore.getState().select(next);
  const isSelected = (row: ChangeRow) =>
    current?.kind === "git" && current.path === row.path && current.staged === row.staged;
  const rest = sections.staged.length + sections.changes.length;

  return (
    <section
      id={REVIEW_PANEL_ID}
      tabIndex={-1}
      aria-label={t("Changes")}
      className="flex h-full flex-col outline-none"
    >
      <header className="flex h-10 shrink-0 items-center gap-2 pr-1.5 pl-3.5">
        <h2 className="text-xs font-medium text-fg">{t("Changes")}</h2>
        {sections.count > 0 && (
          <span className="text-xs text-fg-subtle tabular-nums">{sections.count}</span>
        )}
        <span className="flex-1" />
        {dir && (
          <IconButton
            size="sm"
            icon={RotateCw}
            label={t("Refresh")}
            onClick={() => void useChangesStore.getState().refresh()}
          />
        )}
        <IconButton
          size="sm"
          icon={X}
          label={t("Close")}
          onClick={() => useReviewStore.getState().close()}
        />
      </header>

      {sections.count === 0 ? (
        <div className="min-h-0 flex-1">
          {problem === "not_repo" ? (
            <EmptyState
              icon={FolderGit2}
              title={t("Not a git repository")}
              description={t("This folder is not under Git version control.")}
            />
          ) : (
            <EmptyState
              icon={CircleCheck}
              title={t("No changes")}
              description={t("The working tree matches the last commit.")}
            />
          )}
        </div>
      ) : (
        <>
          <div className="max-h-[40%] shrink-0 overflow-y-auto px-1.5 pb-2 [scrollbar-width:thin]">
            {sections.turn.length > 0 && (
              <TurnGroup
                changes={sections.turn}
                root={status?.root ?? null}
                selected={current?.kind === "turn" ? current.path : null}
                onSelect={(path) => select({ kind: "turn", path })}
              />
            )}
            {rest > 0 && status && (
              <div data-change-list className={cn(sections.turn.length > 0 && "mt-3")}>
                <h3 className="px-2.5 pb-0.5 text-[11px] font-medium text-fg-subtle">
                  {t("Other uncommitted changes")}
                </h3>
                <ChangeGroup
                  title={t("Staged")}
                  rows={sections.staged}
                  staged
                  root={status.root}
                  onSelect={(row) => select({ kind: "git", path: row.path, staged: true })}
                  isSelected={isSelected}
                />
                <ChangeGroup
                  title={t("Changes")}
                  rows={sections.changes}
                  staged={false}
                  root={status.root}
                  onSelect={(row) => select({ kind: "git", path: row.path, staged: false })}
                  isSelected={isSelected}
                />
              </div>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col border-t border-white/[0.05]">
            {current && <SelectedDiff selection={current} turn={sections.turn} />}
          </div>
        </>
      )}

      {status && (
        <footer className="shrink-0 border-t border-white/[0.05] pt-2">
          <CommitBox />
          <BranchBar status={status} />
        </footer>
      )}
    </section>
  );
}

/** A path for a row: relative to the repository when inside it. */
function relativeTo(root: string | null, file: string): string {
  const key = pathKey(file);
  const base = root ? `${pathKey(root)}/` : null;
  const slashed = file.replace(/\\/g, "/");
  return base && key.startsWith(base) ? slashed.slice(base.length) : slashed;
}

interface TurnGroupProps {
  changes: ReviewChange[];
  root: string | null;
  selected: string | null;
  onSelect: (path: string) => void;
}

/** "This turn": the agent's changes since the last Accept, each revertable. */
function TurnGroup({ changes, root, selected, onSelect }: TurnGroupProps) {
  const session = useAgentStore(selectActiveSession);
  const [conflicts, setConflicts] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  if (!session) return null;
  const store = useAgentStore.getState;

  const revert = async (path: string) => {
    setError(null);
    try {
      const result = await store().revertChange(session.sessionId, path);
      if (result === "conflict") setConflicts((prev) => new Set(prev).add(path));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <section aria-label={t("This turn")}>
      <div className="flex h-8 items-center gap-1.5 pr-1 pl-2.5">
        <h3 className="text-[11px] font-medium text-fg-subtle">{t("This turn")}</h3>
        <span className="text-[11px] text-fg-subtle tabular-nums">{changes.length}</span>
        <span className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          icon={Check}
          onClick={() =>
            void store()
              .acceptChanges(session.sessionId)
              .catch((e: unknown) => setError(errorMessage(e)))
          }
        >
          {t("Accept all")}
        </Button>
      </div>
      <ul className="flex flex-col gap-px">
        {changes.map((change) => (
          <li key={change.path}>
            <TurnRow
              change={change}
              path={relativeTo(root, change.path)}
              selected={selected === change.path}
              conflict={conflicts.has(change.path)}
              onSelect={() => onSelect(change.path)}
              onRevert={() => void revert(change.path)}
            />
          </li>
        ))}
      </ul>
      {error && <p className="px-2.5 pt-1 text-2xs text-danger">{error}</p>}
    </section>
  );
}

function TurnRow({
  change,
  path,
  selected,
  conflict,
  onSelect,
  onRevert,
}: {
  change: ReviewChange;
  path: string;
  selected: boolean;
  conflict: boolean;
  onSelect: () => void;
  onRevert: () => void;
}) {
  const { name, dir } = splitPath(path);
  const stats = useMemo(
    () =>
      change.newText === undefined || change.oldText === undefined
        ? null
        : diffStats(diffLines(change.oldText, change.newText)),
    [change.oldText, change.newText],
  );
  return (
    <div
      className={cn(
        "group flex h-7 items-center gap-2 rounded-md pr-1 text-fg-muted transition-[background-color,color] duration-fast hover:bg-white/[0.04] hover:text-fg",
        selected && "bg-white/[0.06] text-fg",
      )}
    >
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        title={change.path}
        onClick={onSelect}
        className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-md pl-2.5 text-left text-[13px] outline-none focus-visible:ring-1 focus-visible:ring-border-strong"
      >
        <FileIcon name={name} />
        <span className="min-w-0 truncate">{name}</span>
        {change.oldText === null && <span className="text-3xs text-fg-subtle">{t("new")}</span>}
        {dir && <span className="min-w-0 flex-1 truncate text-2xs text-fg-subtle">{dir}</span>}
      </button>
      {stats && <DiffStat {...stats} />}
      {conflict ? (
        <span className="text-2xs text-warning">{t("File changed since")}</span>
      ) : (
        <button
          type="button"
          onClick={onRevert}
          className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-2xs text-fg-subtle opacity-0 transition-[opacity,color,background-color] duration-fast group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-hover hover:text-fg"
        >
          <Undo2 size={12} strokeWidth={1.75} aria-hidden />
          {t("Revert")}
        </button>
      )}
    </div>
  );
}

type DiffState = RowDiff | { error: string } | null;

/** The selected file's diff in Monaco's diff view. */
function SelectedDiff({ selection, turn }: { selection: ReviewSelection; turn: ReviewChange[] }) {
  const dir = useChangesStore((s) => s.dir);
  const root = useChangesStore((s) => s.status?.root ?? null);
  const version = useChangesStore((s) => s.version);
  const [loaded, setLoaded] = useState<{ key: string; state: DiffState }>({ key: "", state: null });
  const key =
    selection.kind === "git" ? `${selection.staged ? "s" : "w"}:${selection.path}:${version}` : "";

  useEffect(() => {
    if (selection.kind !== "git" || !dir || !root) return;
    let alive = true;
    const row: ChangeRow = {
      path: selection.path,
      origPath: null,
      kind: "modified",
      staged: selection.staged,
    };
    const status = useChangesStore.getState().status;
    const entry = status?.entries.find((e) => e.path === selection.path);
    if (entry) {
      row.origPath = selection.staged ? entry.origPath : null;
      row.kind = selection.staged
        ? (entry.staged ?? "modified")
        : entry.conflicted
          ? "conflicted"
          : entry.untracked
            ? "untracked"
            : (entry.unstaged ?? "modified");
    }
    readRowDiff(dir, root, row).then(
      (diff) => alive && setLoaded({ key, state: diff }),
      (err: unknown) => alive && setLoaded({ key, state: { error: describeChangesError(err) } }),
    );
    return () => {
      alive = false;
    };
  }, [selection, dir, root, key]);

  const note = (text: string, danger = false) => (
    <p className={cn("px-3.5 py-3 text-2xs", danger ? "text-danger" : "text-fg-subtle")}>{text}</p>
  );

  let diff: RowDiff;
  if (selection.kind === "turn") {
    const change = turn.find((c) => c.path === selection.path);
    if (!change || change.newText === undefined || change.oldText === undefined) {
      return note(t("Open the file to see this change."));
    }
    diff = { file: change.path, oldText: change.oldText, newText: change.newText };
  } else {
    const state = loaded.key === key ? loaded.state : null;
    if (state === null) return note(t("Loading diff…"));
    if ("error" in state) return note(state.error, true);
    diff = state;
  }
  return (
    <Suspense fallback={note(t("Loading diff…"))}>
      <ReviewDiff file={diff.file} oldText={diff.oldText} newText={diff.newText} />
    </Suspense>
  );
}
