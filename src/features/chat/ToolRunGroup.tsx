import { memo, useId } from "react";
import { ChevronRight, Layers } from "lucide-react";
import type { TerminalView } from "@/features/agents/reducer";
import { cn } from "@/shared/ui/cn";
import { Collapse } from "./Disclosure";
import { DiffStat } from "./DiffPreview";
import { formatDuration } from "./format";
import { STATUS_SLOT, ToolCallCard } from "./ToolCallCard";
import { failedText, summaryText, type ToolItem, type ToolRun } from "./toolRuns";

interface ToolRunGroupProps {
  run: ToolRun;
  open: boolean;
  onToggle: (id: string) => void;
  terminals: Record<string, TerminalView>;
}

type Segment = { pinned: true; item: ToolItem } | { pinned: false; items: ToolItem[] };

/** Consecutive folded calls share one collapsible block; pinned calls sit between them. */
function segments(run: ToolRun): Segment[] {
  const out: Segment[] = [];
  run.items.forEach((item, i) => {
    const last = out[out.length - 1];
    if (run.pinned[i]) out.push({ pinned: true, item });
    else if (last && !last.pinned) last.items.push(item);
    else out.push({ pinned: false, items: [item] });
  });
  return out;
}

/**
 * A run of tool calls folded into one row shaped like a tool card's header: what the run
 * did ("Read 5 files, ran 2 commands"), its diff lines and time. Calls that still matter
 * (running, failed, awaiting permission, showing pictures) stay visible under it, in place.
 */
export const ToolRunGroup = memo(function ToolRunGroup({
  run,
  open,
  onToggle,
  terminals,
}: ToolRunGroupProps) {
  const baseId = useId();
  const parts = segments(run);
  const bodyIds = parts.flatMap((p, i) => (p.pinned ? [] : [`${baseId}-${i}`]));
  const { summary } = run;
  const failed = failedText(summary);
  const card = (item: ToolItem) => (
    <ToolCallCard
      key={item.id}
      call={item.call}
      startedAt={item.startedAt}
      endedAt={item.endedAt}
      terminals={terminals}
    />
  );

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyIds.join(" ")}
        onClick={() => onToggle(run.id)}
        className="group/run -mx-2 flex h-8 w-[calc(100%+1rem)] min-w-0 items-center gap-2.5 rounded-md px-2 text-left text-xs transition-colors duration-fast hover:bg-hover"
      >
        <Layers size={14} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-subtle" />
        <span className="min-w-0 truncate text-fg-muted">{summaryText(summary)}</span>
        {failed && <span className="shrink-0 text-danger">{failed}</span>}
        {(summary.added > 0 || summary.removed > 0) && (
          <DiffStat added={summary.added} removed={summary.removed} />
        )}
        <span className="flex-1" />
        {summary.durationMs !== null && (
          <span className="shrink-0 text-2xs text-fg-subtle tabular-nums">
            {formatDuration(summary.durationMs)}
          </span>
        )}
        <span aria-hidden className={STATUS_SLOT} />
        <ChevronRight
          size={13}
          strokeWidth={1.75}
          aria-hidden
          className={cn(
            "-mr-0.5 shrink-0 text-fg-subtle transition-[rotate,color] duration-base ease-out-quint group-hover/run:text-fg-muted",
            open && "rotate-90",
          )}
        />
      </button>
      {parts.map((part, i) =>
        part.pinned ? (
          <div key={part.item.id} className="mt-0.5">
            {card(part.item)}
          </div>
        ) : (
          <Collapse key={part.items[0].id} open={open} id={`${baseId}-${i}`}>
            <div className="flex flex-col gap-0.5 pt-0.5">{part.items.map(card)}</div>
          </Collapse>
        ),
      )}
    </div>
  );
});
