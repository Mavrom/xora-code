import type { CSSProperties } from "react";
import { cn } from "@/shared/ui/cn";

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  labelledBy?: string;
  /** Value shown next to the track and read out by screen readers, e.g. `24 px`. */
  format: (value: number) => string;
  disabled?: boolean;
}

/** Native range input (keyboard and screen readers for free) with a filled track. */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  labelledBy,
  format,
  disabled,
}: SliderProps) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className={cn("flex w-60 shrink-0 items-center gap-3", disabled && "opacity-40")}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-labelledby={labelledBy}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range-slider min-w-0 flex-1"
        style={{ "--fill": `${fill}%` } as CSSProperties}
      />
      <output
        aria-hidden
        className="w-11 shrink-0 text-right font-mono text-2xs text-fg-muted tabular-nums"
      >
        {format(value)}
      </output>
    </div>
  );
}
