import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/shared/ui/cn";
import type { SegmentedOption } from "./Segmented";
import { stepIndex } from "./keyboard";

interface QuietChoicesProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  labelledBy?: string;
}

/**
 * A row of borderless choices, the look of the composer's settings panel: muted text, a
 * soft fill on the current one. Arrow keys move the selection (roving tabindex).
 */
export function QuietChoices<T extends string>({
  value,
  options,
  onChange,
  labelledBy,
}: QuietChoicesProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = stepIndex(e.key, index, options.length);
    if (next === null) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      className="flex flex-wrap justify-end gap-px"
    >
      {options.map((option, i) => {
        const selected = i === index;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-2 py-[3px] text-[12.5px] whitespace-nowrap transition-colors duration-fast outline-none focus-visible:ring-1 focus-visible:ring-fg-subtle",
              selected
                ? "bg-border-strong text-fg"
                : "text-fg-subtle hover:bg-hover hover:text-fg-muted",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
