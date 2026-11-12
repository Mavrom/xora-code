import { useId, useMemo, useState } from "react";
import { Check, Undo2 } from "lucide-react";
import { errorMessage } from "@/features/agents/ipc";
import type { ReviewChange } from "@/features/agents/reducer";
import { selectActiveSession, useAgentStore } from "@/features/agents/store";
import { DiffStat } from "@/features/chat/DiffPreview";
import { diffLines, diffStats } from "@/features/chat/diff";
import { openTurnChange } from "@/features/chat/turnChanges";
import { FileIcon } from "@/features/files/FileIcon";
import { relativeTo, splitPath } from "./changes";
import { useChangesStore } from "./changesStore";
import { RowAction } from "./ChangeRow";
import { t } from "@/shared/i18n";

const NONE: ReviewChange[] = [];

const failed = (err: unknown) =>
  useChangesStore.getState().setNotice({ text: errorMessage(err), error: true });

/**
 * "This turn": the files the active chat's last turn changed, above the working tree in the
 * Changes view. A row opens its diff tab; hover or focus reveals accept and revert. Accept
 * lets the core drop the file's snapshot; revert restores the old content unless the file
 * changed again since (then the diff opens so the user can decide).
 */
export function TurnGroup({ root }: { root: string | null }) {
  const sessionId = useAgentStore((s) => selectActiveSession(s)?.sessionId ?? null);
  const changes = useAgentStore((s) => {
    const session = selectActiveSession(s);
    return session && session.turn === "idle" ? session.changes : NONE;
  });
  if (!sessionId || changes.length === 0) return null;
  // Keyed so another chat starts without this one's conflict marks.
  return <TurnList key={sessionId} sessionId={sessionId} changes={changes} root={root} />;
}

interface TurnListProps {
  sessionId: string;
  changes: ReviewChange[];
  root: string | null;
}

function TurnList({ sessionId, changes, root }: TurnListProps) {
  const headingId = useId();
  const [conflicts, setConflicts] = useState<ReadonlySet<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const store = useAgentStore.getState;
  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await action();
    } catch (err) {
      failed(err);
    } finally {
      setBusy(null);
    }
  };
  const revert = (change: ReviewChange) =>
    run(change.path, async () => {
      if ((await store().revertChange(sessionId, change.path)) === "conflict") {
        setConflicts((prev) => new Set(prev).add(change.path));
        openTurnChange(change);
      }
    });

  return (
    <section aria-labelledby={headingId}>
      <div className="group flex h-7 items-center gap-1.5 pr-1 pl-2.5">
        <h3 id={headingId} className="min-w-0 truncate text-[11px] font-medium text-fg-subtle">
          {t("This turn")}
        </h3>
        <span className="text-[11px] text-fg-subtle tabular-nums">{changes.length}</span>
        <span className="flex-1" />
        <span className="flex items-center gap-0.5 opacity-0 transition-opacity duration-fast group-focus-within:opacity-100 group-hover:opacity-100">
          <RowAction
            icon={Check}
            label={t("Accept all")}
            disabled={busy !== null}
            onClick={() => void run("*", () => store().acceptChanges(sessionId))}
          />
        </span>
      </div>
      <ul className="flex flex-col gap-px">
        {changes.map((change) => (
          <li key={change.path}>
            <TurnRow
              change={change}
              shown={relativeTo(root, change.path)}
              conflict={conflicts.has(change.path)}
              busy={busy !== null}
              onAccept={() =>
                void run(change.path, () => store().acceptChanges(sessionId, change.path))
              }
              onRevert={() => void revert(change)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface TurnRowProps {
  change: ReviewChange;
  /** The path as shown: relative to the checkout when inside it. */
  shown: string;
  conflict: boolean;
  busy: boolean;
  onAccept: () => void;
  onRevert: () => void;
}

function TurnRow({ change, shown, conflict, busy, onAccept, onRevert }: TurnRowProps) {
  const { name, dir } = splitPath(shown);
  const stats = useMemo(
    () =>
      change.newText === undefined || change.oldText === undefined
        ? null
        : diffStats(diffLines(change.oldText, change.newText)),
    [change.oldText, change.newText],
  );

  return (
    <div className="group flex h-7 items-center rounded-md text-fg-muted transition-[background-color,color] duration-fast focus-within:bg-white/[0.04] hover:bg-white/[0.04] hover:text-fg">
      <button
        type="button"
        data-change-row
        title={change.path}
        aria-label={t("Open diff of {name}", { name: shown })}
        onClick={() => openTurnChange(change)}
        className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-md pl-2.5 text-left text-[13px] outline-none focus-visible:ring-1 focus-visible:ring-border-strong"
      >
        <FileIcon name={name} />
        <span className="min-w-0 truncate">{name}</span>
        {dir && <span className="min-w-0 flex-1 truncate text-2xs text-fg-subtle">{dir}</span>}
      </button>
      {conflict ? (
        <span className="mr-2 ml-1 shrink-0 text-2xs text-warning">{t("File changed since")}</span>
      ) : (
        <span className="flex max-w-0 shrink-0 items-center gap-0.5 overflow-hidden group-focus-within:max-w-32 group-hover:max-w-32">
          <RowAction icon={Undo2} label={t("Revert")} danger disabled={busy} onClick={onRevert} />
          <RowAction icon={Check} label={t("Accept")} disabled={busy} onClick={onAccept} />
        </span>
      )}
      <span className="mr-2 ml-1 shrink-0">
        {change.oldText === null ? (
          <span className="text-3xs text-fg-subtle">{t("new")}</span>
        ) : (
          stats && <DiffStat {...stats} />
        )}
      </span>
    </div>
  );
}
