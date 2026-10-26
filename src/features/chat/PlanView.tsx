import { memo } from "react";
import { Check } from "lucide-react";
import type { AcpPlanEntry } from "@/features/agents/types";
import { cn } from "@/shared/ui/cn";

/** The agent's current plan as a quiet checklist with a progress count. */
export const PlanView = memo(function PlanView({ entries }: { entries: AcpPlanEntry[] }) {
  if (entries.length === 0) return null;
  const done = entries.filter((e) => e.status === "completed").length;

  return (
    <section
      aria-label="Plan"
      className="rounded-lg border border-border bg-surface px-3.5 pt-2.5 pb-3"
    >
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-2xs font-medium tracking-wide text-fg-subtle uppercase">Plan</h3>
        <span className="text-2xs text-fg-subtle tabular-nums">
          {done}/{entries.length}
        </span>
      </header>
      <ol className="flex flex-col gap-1.5">
        {entries.map((entry, index) => (
          <li key={index} className="flex items-start gap-2.5 text-xs">
            <PlanMark status={entry.status} />
            <span
              className={cn(
                "min-w-0 flex-1",
                entry.status === "completed" &&
                  "text-fg-subtle line-through decoration-fg-subtle/60",
                entry.status === "in_progress" && "text-fg",
                entry.status === "pending" && "text-fg-muted",
              )}
            >
              {entry.content}
              {entry.priority === "high" && entry.status !== "completed" && (
                <span className="ml-1.5 text-3xs text-fg-subtle">öncelikli</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
});

function PlanMark({ status }: { status: AcpPlanEntry["status"] }) {
  const label = { pending: "Bekliyor", in_progress: "Sürüyor", completed: "Bitti" }[status];
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "mt-[3px] grid size-3.5 shrink-0 place-items-center rounded-full border",
        status === "completed" && "border-fg-subtle/60 bg-fg-subtle/15 text-fg-muted",
        status === "in_progress" && "border-fg",
        status === "pending" && "border-border-strong",
      )}
    >
      {status === "completed" && <Check size={9} strokeWidth={3} aria-hidden />}
      {status === "in_progress" && <span className="size-1.5 rounded-full bg-fg" />}
    </span>
  );
}
