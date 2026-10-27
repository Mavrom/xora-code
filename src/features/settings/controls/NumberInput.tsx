import { useState, type KeyboardEvent } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { parseClamped } from "./keyboard";
import { t } from "@/shared/i18n";

interface NumberInputProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  labelledBy?: string;
  /** Unit after the number, e.g. "px". */
  unit?: string;
}

/** Stepper with a typed field: −/+ buttons, arrow keys, and clamping on commit. */
export function NumberInput({ value, min, max, onChange, labelledBy, unit }: NumberInputProps) {
  // Local text while typing; `null` means "show the stored value".
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (next: number) => {
    setDraft(null);
    const clamped = Math.min(max, Math.max(min, next));
    if (clamped !== value) onChange(clamped);
  };

  const commitDraft = () => {
    if (draft === null) return;
    const parsed = parseClamped(draft, min, max);
    if (parsed === null) setDraft(null);
    else commit(parsed);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      commit(value + (e.key === "ArrowUp" ? 1 : -1));
    } else if (e.key === "Enter") {
      commitDraft();
    } else if (e.key === "Escape" && draft !== null) {
      // First Esc drops the edit; the next one may close the settings view.
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      setDraft(null);
    }
  };

  const stepButton = (delta: number) => {
    const Icon = delta > 0 ? Plus : Minus;
    const disabled = delta > 0 ? value >= max : value <= min;
    return (
      <button
        type="button"
        tabIndex={-1}
        aria-label={delta > 0 ? t("Increase") : t("Decrease")}
        disabled={disabled}
        onClick={() => commit(value + delta)}
        className="grid h-full w-7 place-items-center text-fg-subtle transition-colors duration-fast hover:bg-hover hover:text-fg disabled:opacity-35 disabled:hover:bg-transparent"
      >
        <Icon size={12} strokeWidth={2} aria-hidden />
      </button>
    );
  };

  return (
    <div
      className={cn(
        "flex h-7 shrink-0 items-stretch overflow-hidden rounded-md border border-border-strong bg-elevated transition-[border-color,box-shadow] duration-base",
        "focus-within:border-fg-subtle/60 focus-within:shadow-halo",
      )}
    >
      {stepButton(-1)}
      <label className="flex items-center border-x border-border px-1.5">
        <input
          type="text"
          inputMode="numeric"
          role="spinbutton"
          aria-labelledby={labelledBy}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={onKeyDown}
          onFocus={(e) => e.target.select()}
          className="w-6 bg-transparent text-right text-xs text-fg tabular-nums outline-none focus-visible:outline-none"
        />
        {unit && <span className="pl-0.5 text-2xs text-fg-subtle">{unit}</span>}
      </label>
      {stepButton(1)}
    </div>
  );
}
