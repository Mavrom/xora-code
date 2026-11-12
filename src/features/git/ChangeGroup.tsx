import { useId } from "react";
import { Minus, Plus, Undo2 } from "lucide-react";
import { rowPaths, type ChangeRow as Row } from "./changes";
import { ChangeRow, RowAction } from "./ChangeRow";
import { confirmDiscard } from "./confirmDiscard";
import { useChangesStore } from "./changesStore";
import { t } from "@/shared/i18n";

interface ChangeGroupProps {
  title: string;
  rows: Row[];
  /** The "Staged" group (unstage actions) rather than "Changes" (stage and discard). */
  staged: boolean;
  root: string;
  /** In the Review panel: the row whose diff is shown, and how to show another. */
  onSelect?: (row: Row) => void;
  isSelected?: (row: Row) => boolean;
}

/** A titled list of changed files with its group-wide actions. */
export function ChangeGroup({ title, rows, staged, root, onSelect, isSelected }: ChangeGroupProps) {
  const headingId = useId();
  const busy = useChangesStore((s) => s.busy !== null);
  const store = useChangesStore.getState;
  if (rows.length === 0) return null;

  // Conflicted files are left to the user: staging them marks them resolved, and git
  // cannot restore them.
  const plain = rows.filter((r) => r.kind !== "conflicted");
  const discardAll = async () => {
    if (await confirmDiscard(plain)) void store().discard(rowPaths(plain));
  };

  return (
    <section aria-labelledby={headingId} className="mt-2 first:mt-0">
      <div className="group flex h-7 items-center gap-1.5 pr-1 pl-2.5">
        <h3 id={headingId} className="min-w-0 truncate text-[11px] font-medium text-fg-subtle">
          {title}
        </h3>
        <span className="text-[11px] text-fg-subtle tabular-nums">{rows.length}</span>
        <span className="flex-1" />
        <span className="flex items-center gap-0.5 opacity-0 transition-opacity duration-fast group-focus-within:opacity-100 group-hover:opacity-100">
          {staged ? (
            <RowAction
              icon={Minus}
              label={t("Unstage all")}
              disabled={busy}
              onClick={() => void store().unstage(rowPaths(rows))}
            />
          ) : (
            plain.length > 0 && (
              <>
                <RowAction
                  icon={Undo2}
                  label={t("Discard all changes")}
                  danger
                  disabled={busy}
                  onClick={() => void discardAll()}
                />
                <RowAction
                  icon={Plus}
                  label={t("Stage all")}
                  disabled={busy}
                  onClick={() => void store().stage(rowPaths(plain))}
                />
              </>
            )
          )}
        </span>
      </div>
      <ul className="flex flex-col gap-px">
        {rows.map((row) => (
          <li key={row.path}>
            <ChangeRow
              row={row}
              root={root}
              onSelect={onSelect && (() => onSelect(row))}
              selected={isSelected?.(row) ?? false}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
