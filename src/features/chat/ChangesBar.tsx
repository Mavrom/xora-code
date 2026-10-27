import { useId, useMemo, useState } from "react";
import { Check, ChevronRight, FileDiff, Undo2 } from "lucide-react";
import type { ReviewChange } from "@/features/agents/reducer";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/ui/cn";
import { Collapse } from "./Disclosure";
import { DiffStat } from "./DiffPreview";
import { diffLines, diffStats } from "./diff";
import { canOpenDiff, openDiffInEditor, revealInEditor } from "./editorBridge";
import { fileName } from "./toolView";
import { t } from "@/shared/i18n";

interface ChangesBarProps {
  changes: ReviewChange[];
  onAccept: () => void;
  onRevert: (path: string) => Promise<"reverted" | "conflict">;
}

/**
 * After a turn: the files the agent changed, each revertable. "Kabul et" clears the list;
 * "Geri al" restores the old content unless the file changed again since (then the diff
 * opens so the user can decide).
 */
export function ChangesBar({ changes, onAccept, onRevert }: ChangesBarProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [conflicts, setConflicts] = useState<ReadonlySet<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const revert = async (change: ReviewChange) => {
    setBusy(change.path);
    try {
      const result = await onRevert(change.path);
      if (result === "conflict") {
        setConflicts((prev) => new Set(prev).add(change.path));
        if (change.newText !== undefined) {
          openDiffInEditor(change.path, change.oldText ?? null, change.newText);
        }
      }
    } finally {
      setBusy(null);
    }
  };

  if (changes.length === 0) return null;

  return (
    <section
      aria-label={t("Changes")}
      className="mb-2 rounded-xl border border-glass-border bg-glass backdrop-blur-xl transition-[opacity,translate] duration-base ease-out-quint starting:translate-y-1 starting:opacity-0"
    >
      <div className="flex h-10 items-center gap-2 pr-1.5 pl-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-md px-1.5 text-xs text-fg-muted transition-colors duration-fast hover:text-fg"
        >
          <ChevronRight
            size={13}
            strokeWidth={1.75}
            aria-hidden
            className={cn("transition-transform duration-base ease-out-quint", open && "rotate-90")}
          />
          <FileDiff size={13} strokeWidth={1.75} aria-hidden className="text-fg-subtle" />
          <span className="text-fg">{t("Changes")}</span>
          <span className="text-fg-subtle tabular-nums">{changes.length}</span>
        </button>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" icon={Check} onClick={onAccept}>
          {t("Accept")}
        </Button>
      </div>
      <Collapse open={open} id={id}>
        <ul className="border-t border-glass-border px-1.5 py-1">
          {changes.map((change) => (
            <ChangeRow
              key={change.path}
              change={change}
              conflict={conflicts.has(change.path)}
              busy={busy === change.path}
              onRevert={() => void revert(change)}
            />
          ))}
        </ul>
      </Collapse>
    </section>
  );
}

function ChangeRow({
  change,
  conflict,
  busy,
  onRevert,
}: {
  change: ReviewChange;
  conflict: boolean;
  busy: boolean;
  onRevert: () => void;
}) {
  const stats = useMemo(
    () =>
      change.newText === undefined || change.oldText === undefined
        ? null
        : diffStats(diffLines(change.oldText, change.newText)),
    [change.oldText, change.newText],
  );
  const diffable = canOpenDiff() && change.newText !== undefined;

  return (
    <li className="group flex h-8 items-center gap-2 rounded-md px-1.5 hover:bg-hover/60">
      <button
        type="button"
        title={change.path}
        onClick={() =>
          diffable && change.newText !== undefined
            ? openDiffInEditor(change.path, change.oldText ?? null, change.newText)
            : revealInEditor(change.path)
        }
        className="min-w-0 truncate text-left font-mono text-2xs text-fg-muted transition-colors duration-fast hover:text-fg"
      >
        {fileName(change.path)}
      </button>
      {change.oldText === null && <span className="text-3xs text-fg-subtle">{t("new")}</span>}
      {stats && <DiffStat {...stats} />}
      <span className="flex-1" />
      {conflict ? (
        <span className="text-2xs text-warning">{t("File changed since")}</span>
      ) : (
        <button
          type="button"
          onClick={onRevert}
          disabled={busy}
          className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-2xs text-fg-subtle opacity-0 transition-[opacity,color,background-color] duration-fast group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-hover hover:text-fg disabled:opacity-60"
        >
          <Undo2 size={12} strokeWidth={1.75} aria-hidden />
          {t("Revert")}
        </button>
      )}
    </li>
  );
}
