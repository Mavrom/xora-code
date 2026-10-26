import { memo, useEffect, useId, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { Collapse } from "./Disclosure";
import { formatDuration } from "./format";

interface ThinkingBlockProps {
  text: string;
  /** Still streaming thoughts. */
  active: boolean;
  startedAt: number;
  endedAt: number | null;
}

/**
 * The agent's reasoning. While it streams, a short live window shows the latest lines under a
 * shimmering "Düşünüyor…"; once done it folds into "Düşündü · 12 sn" and opens on demand.
 */
export const ThinkingBlock = memo(function ThinkingBlock({
  text,
  active,
  startedAt,
  endedAt,
}: ThinkingBlockProps) {
  const bodyId = useId();
  const [open, setOpen] = useState(false);
  const liveRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  // Keep the live window pinned to the newest line; fade the top only once it overflows.
  useEffect(() => {
    const el = liveRef.current;
    if (!active || !el) return;
    el.scrollTop = el.scrollHeight;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [active, text]);

  const label = active
    ? "Düşünüyor…"
    : `Düşündü${endedAt ? ` · ${formatDuration(endedAt - startedAt)}` : ""}`;

  return (
    <div className="text-xs">
      <button
        type="button"
        aria-expanded={active ? true : open}
        aria-controls={bodyId}
        disabled={active}
        onClick={() => setOpen((v) => !v)}
        className="group -ml-1 inline-flex h-7 items-center gap-1 rounded-md pr-2 pl-1 text-fg-subtle transition-colors duration-fast hover:text-fg-muted disabled:cursor-default"
      >
        <ChevronRight
          size={13}
          strokeWidth={1.75}
          aria-hidden
          className={cn(
            "transition-transform duration-base ease-out-quint",
            (open || active) && "rotate-90",
          )}
        />
        <span className={cn(active && "shimmer")}>{label}</span>
      </button>
      {active ? (
        <div
          id={bodyId}
          ref={liveRef}
          className={cn(
            "ml-1.5 max-h-[6.5lh] overflow-hidden border-l border-border pl-3.5 leading-relaxed whitespace-pre-wrap text-fg-subtle",
            overflowing && "[mask-image:linear-gradient(to_bottom,transparent,black_2.5lh)]",
          )}
        >
          {text}
        </div>
      ) : (
        <Collapse open={open} id={bodyId}>
          <div className="mt-1 mb-1 ml-1.5 border-l border-border pl-3.5 leading-relaxed whitespace-pre-wrap text-fg-muted select-text">
            {text}
          </div>
        </Collapse>
      )}
    </div>
  );
});
