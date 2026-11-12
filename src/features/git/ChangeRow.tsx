import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, FileDiff, Minus, Plus, Undo2, type LucideIcon } from "lucide-react";
import { DiffBody } from "@/features/chat/DiffPreview";
import { revealInEditor } from "@/features/chat/editorBridge";
import { FileIcon } from "@/features/files/FileIcon";
import { cn } from "@/shared/ui/cn";
import {
  changesErrorCode,
  describeChangesError,
  filePath,
  splitPath,
  statusLabel,
  statusLetter,
  statusTone,
  type ChangeRow as Row,
} from "./changes";
import { useChangesStore } from "./changesStore";
import { confirmDiscard } from "./confirmDiscard";
import { gitIpc } from "./ipc";
import { openRowDiff } from "./openRowDiff";
import { parseUnifiedDiff, type ParsedDiff } from "./unifiedDiff";
import { t } from "@/shared/i18n";

/**
 * One changed file: icon, name, dimmed folder and status letter. Activating it unfolds its
 * diff; hover or keyboard focus reveals "open diff" (an editor tab), "open file" and
 * stage / unstage / discard.
 */
export function ChangeRow({
  row,
  root,
  onSelect,
  selected = false,
}: {
  row: Row;
  root: string;
  /** In the Review panel: activating the row shows its diff there instead of unfolding it. */
  onSelect?: () => void;
  selected?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const busy = useChangesStore((s) => s.busy !== null);
  const diffId = useId();
  const { name, dir } = splitPath(row.path);
  const label = statusLabel(row.kind);
  const store = useChangesStore.getState;
  const button = useRef<HTMLButtonElement>(null);

  /**
   * Runs an action that moves this row to the other group (or removes it), then gives
   * keyboard focus to the row now in its place, so the next file is one keypress away.
   */
  const act = async (action: () => Promise<unknown>) => {
    const own = button.current;
    const group = own?.closest("ul");
    const list = own?.closest<HTMLElement>("[data-change-list]");
    const rows = () => [...(group?.querySelectorAll<HTMLElement>("[data-change-row]") ?? [])];
    const index = own ? rows().indexOf(own) : -1;
    const hadFocus = own?.parentElement?.contains(document.activeElement) ?? false;
    await action();
    if (!hadFocus) return;
    requestAnimationFrame(() => {
      if (own?.isConnected && own.parentElement?.contains(document.activeElement)) return;
      const left = group?.isConnected ? rows() : [];
      const next =
        left[Math.min(index, left.length - 1)] ?? list?.querySelector("[data-change-row]");
      (next instanceof HTMLElement ? next : list)?.focus();
    });
  };

  // A binary or oversized file says so under the branch line instead of opening a tab.
  const openDiff = () => {
    const dir = store().dir;
    if (!dir) return;
    openRowDiff(dir, root, row).catch((err: unknown) =>
      store().setNotice({
        text: describeChangesError(err),
        error: changesErrorCode(err) !== "binary",
      }),
    );
  };

  const discard = () =>
    act(async () => {
      if (await confirmDiscard([row])) await store().discard([row.path]);
    });

  return (
    <>
      <div
        className={cn(
          "group flex h-7 items-center rounded-md text-fg-muted transition-[background-color,color] duration-fast focus-within:bg-white/[0.04] hover:bg-white/[0.04] hover:text-fg",
          selected && "bg-white/[0.06] text-fg",
        )}
      >
        <button
          ref={button}
          type="button"
          data-change-row
          aria-expanded={onSelect ? undefined : open}
          aria-controls={!onSelect && open ? diffId : undefined}
          aria-current={onSelect && selected ? "true" : undefined}
          aria-label={`${row.path}, ${label}`}
          title={row.origPath ? `${row.origPath} → ${row.path}` : row.path}
          onClick={() => (onSelect ? onSelect() : setOpen((v) => !v))}
          className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-md pl-2.5 text-left text-[13px] outline-none focus-visible:ring-1 focus-visible:ring-border-strong"
        >
          <FileIcon name={name} />
          <span className="min-w-0 truncate">{name}</span>
          {dir && <span className="min-w-0 flex-1 truncate text-2xs text-fg-subtle">{dir}</span>}
        </button>
        <span className="flex max-w-0 shrink-0 items-center gap-0.5 overflow-hidden group-focus-within:max-w-32 group-hover:max-w-32">
          {!onSelect && <RowAction icon={FileDiff} label={t("Open diff")} onClick={openDiff} />}
          {row.kind !== "deleted" && (
            <RowAction
              icon={ExternalLink}
              label={t("Open file")}
              onClick={() => revealInEditor(filePath(root, row.path))}
            />
          )}
          {!row.staged && row.kind !== "conflicted" && (
            <RowAction
              icon={Undo2}
              label={t("Discard changes")}
              danger
              disabled={busy}
              onClick={() => void discard()}
            />
          )}
          {row.staged ? (
            <RowAction
              icon={Minus}
              label={t("Unstage")}
              disabled={busy}
              onClick={() =>
                void act(() =>
                  store().unstage(row.origPath ? [row.path, row.origPath] : [row.path]),
                )
              }
            />
          ) : (
            <RowAction
              icon={Plus}
              label={row.kind === "conflicted" ? t("Mark resolved") : t("Stage")}
              disabled={busy}
              onClick={() => void act(() => store().stage([row.path]))}
            />
          )}
        </span>
        <span
          title={label}
          aria-hidden
          className={cn(
            "mr-2 ml-1 w-3 shrink-0 text-center font-mono text-2xs font-medium",
            statusTone(row.kind),
          )}
        >
          {statusLetter(row.kind)}
        </span>
      </div>
      {open && !onSelect && <RowDiff id={diffId} row={row} />}
    </>
  );
}

interface RowActionProps {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function RowAction({ icon: Icon, label, danger, disabled, onClick }: RowActionProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-md text-fg-subtle transition-colors duration-fast disabled:opacity-40",
        danger ? "hover:bg-danger/15 hover:text-danger" : "hover:bg-white/[0.08] hover:text-fg",
      )}
    >
      <Icon size={13} strokeWidth={1.75} aria-hidden />
    </button>
  );
}

type DiffState = { diff: ParsedDiff; truncated: boolean } | { error: string } | null;

/** The file's diff on its side (staged or not); reloaded whenever the status refreshes. */
function RowDiff({ id, row }: { id: string; row: Row }) {
  const dir = useChangesStore((s) => s.dir);
  const version = useChangesStore((s) => s.version);
  const [state, setState] = useState<DiffState>(null);

  useEffect(() => {
    if (!dir) return;
    let alive = true;
    gitIpc.diff(dir, row.path, row.staged, row.origPath).then(
      (d) => alive && setState({ diff: parseUnifiedDiff(d.text), truncated: d.truncated }),
      (err: unknown) => alive && setState({ error: describeChangesError(err) }),
    );
    return () => {
      alive = false;
    };
  }, [dir, row.path, row.staged, row.origPath, version]);

  const note = (text: string, danger = false) => (
    <p className={cn("px-3 py-2 text-2xs", danger ? "text-danger" : "text-fg-subtle")}>{text}</p>
  );

  return (
    <div
      id={id}
      role="region"
      aria-label={t("Diff of {name}", { name: row.path })}
      className="mx-1 mt-0.5 mb-1.5 overflow-hidden rounded-md border border-border bg-surface"
    >
      {state === null ? (
        note(t("Loading diff…"))
      ) : "error" in state ? (
        note(state.error, true)
      ) : state.diff.binary ? (
        note(t("Binary file; no preview."))
      ) : state.diff.hunks.length === 0 ? (
        note(t("No line changes."))
      ) : (
        <DiffBody hunks={state.diff.hunks} />
      )}
      {state &&
        "truncated" in state &&
        state.truncated &&
        note(t("The diff is too long to show in full; open the file to see the rest."))}
    </div>
  );
}
