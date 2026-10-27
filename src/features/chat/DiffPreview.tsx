import { Fragment, memo, useMemo, useState } from "react";
import { Columns2 } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { diffLines, diffStats, limitHunks, toHunks, type DiffLine } from "./diff";
import { canOpenDiff, openDiffInEditor, revealInEditor } from "./editorBridge";
import { fileName } from "./toolView";
import { t } from "@/shared/i18n";

/** Rendered rows before "show more"; long rewrites stay cheap to paint. */
const PREVIEW_ROWS = 80;

interface DiffPreviewProps {
  path: string;
  oldText?: string | null;
  newText: string;
  /** Cap on visible rows; the rest sits behind a "show all" row. */
  maxRows?: number;
  className?: string;
}

/** "+12 −3" with the counts in tabular figures. */
export function DiffStat({ added, removed }: { added: number; removed: number }) {
  return (
    <span className="inline-flex shrink-0 gap-1.5 font-mono text-2xs tabular-nums">
      {added > 0 && <span className="text-fg-muted">+{added}</span>}
      {removed > 0 && <span className="text-danger/90">−{removed}</span>}
    </span>
  );
}

/** Inline unified diff: file header, hunks with line numbers, and a hand-off to Monaco. */
export const DiffPreview = memo(function DiffPreview({
  path,
  oldText,
  newText,
  maxRows = PREVIEW_ROWS,
  className,
}: DiffPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const { hunks, stats } = useMemo(() => {
    const lines = diffLines(oldText, newText);
    return { hunks: toHunks(lines), stats: diffStats(lines) };
  }, [oldText, newText]);
  const isNew = oldText === null || oldText === undefined;
  const total = hunks.reduce((sum, h) => sum + h.lines.length, 0);
  const visible = expanded ? hunks : limitHunks(hunks, maxRows);

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-surface", className)}>
      <div className="flex h-8 items-center gap-2 border-b border-border pr-1 pl-3">
        <button
          type="button"
          onClick={() => revealInEditor(path)}
          title={path}
          className="min-w-0 truncate text-left font-mono text-2xs text-fg-muted transition-colors duration-fast hover:text-fg"
        >
          {fileName(path)}
        </button>
        {isNew && (
          <span className="shrink-0 rounded-xs border border-border-strong px-1 text-3xs text-fg-muted">
            {t("new")}
          </span>
        )}
        <DiffStat {...stats} />
        <span className="flex-1" />
        {canOpenDiff() && (
          <button
            type="button"
            onClick={() => openDiffInEditor(path, oldText ?? null, newText)}
            className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-2xs text-fg-subtle transition-colors duration-fast hover:bg-hover hover:text-fg"
          >
            <Columns2 size={12} strokeWidth={1.75} aria-hidden />
            {t("Open in editor")}
          </button>
        )}
      </div>
      {hunks.length === 0 ? (
        <p className="px-3 py-2 text-2xs text-fg-subtle">{t("Content unchanged.")}</p>
      ) : (
        <div className="max-h-90 overflow-auto py-1 font-mono text-2xs leading-[18px]">
          <table className="w-full border-collapse">
            <tbody>
              {visible.map((hunk, index) => {
                const rows = hunk.lines;
                return (
                  <Fragment key={`${hunk.oldStart}:${hunk.newStart}`}>
                    {index > 0 && (
                      <tr aria-hidden>
                        <td colSpan={3} className="h-5 px-3 text-fg-subtle/70 select-none">
                          ⋯
                        </td>
                      </tr>
                    )}
                    {rows.map((line, i) => (
                      <DiffRow key={i} line={line} />
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {!expanded && total > maxRows && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mx-1 mt-1 h-6 w-[calc(100%-0.5rem)] rounded-md text-2xs text-fg-subtle transition-colors duration-fast hover:bg-hover hover:text-fg"
            >
              {total - maxRows === 1
                ? t("Show 1 more line")
                : t("Show {n} more lines", { n: total - maxRows })}
            </button>
          )}
        </div>
      )}
    </div>
  );
});

const SIGN: Record<DiffLine["type"], string> = { add: "+", del: "−", context: " " };

function DiffRow({ line }: { line: DiffLine }) {
  return (
    <tr
      className={cn(
        line.type === "add" && "bg-fg/[0.055]",
        line.type === "del" && "bg-danger/[0.08]",
      )}
    >
      <td className="w-px pr-2 pl-3 text-right whitespace-nowrap text-fg-subtle/70 tabular-nums select-none">
        {line.type === "add" ? line.newNo : line.oldNo}
      </td>
      <td
        aria-hidden
        className={cn(
          "w-px pr-2 select-none",
          line.type === "add" ? "text-fg" : line.type === "del" ? "text-danger" : "text-fg-subtle",
        )}
      >
        {SIGN[line.type]}
      </td>
      <td
        className={cn(
          "pr-3 whitespace-pre select-text",
          line.type === "del" ? "text-fg-muted" : "text-fg",
        )}
      >
        <span className="sr-only">
          {line.type === "add" ? "eklendi: " : line.type === "del" ? "silindi: " : ""}
        </span>
        {line.text || " "}
      </td>
    </tr>
  );
}
