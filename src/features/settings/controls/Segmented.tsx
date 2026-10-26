import { useRef, type CSSProperties, type KeyboardEvent } from "react";
import { cn } from "@/shared/ui/cn";
import { stepIndex } from "./keyboard";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string | number> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  labelledBy?: string;
  label?: string;
}

/**
 * Equal-width radio group with a sliding pill. Arrow keys move the selection
 * (roving tabindex), like a native radio group.
 */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  labelledBy,
  label,
}: SegmentedProps<T>) {
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
      aria-label={labelledBy ? undefined : label}
      onKeyDown={onKeyDown}
      style={{ "--count": options.length, "--index": index } as CSSProperties}
      className="relative grid h-7 shrink-0 grid-cols-[repeat(var(--count),minmax(0,1fr))] rounded-md border border-border bg-bg p-0.5 shadow-well"
    >
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 w-[calc((100%-4px)/var(--count))] translate-x-[calc(100%*var(--index))] rounded-[5px] border border-border-strong bg-elevated shadow-[0_1px_2px_var(--color-bg)] transition-[translate] duration-slow ease-out-quint"
      />
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
              "relative z-10 min-w-12 truncate rounded-[5px] px-3 text-xs transition-colors duration-fast",
              "focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-muted",
              selected ? "font-medium text-fg" : "text-fg-subtle hover:text-fg-muted",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
