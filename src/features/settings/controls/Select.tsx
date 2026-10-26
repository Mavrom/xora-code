import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { stepIndex } from "./keyboard";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Dim secondary text on the right of the option (e.g. "kurulu değil"). */
  hint?: string;
}

interface SelectProps<T extends string> {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  labelledBy?: string;
}

/**
 * Button + listbox popover (a native <select> cannot be themed on WebView2).
 * Focus stays on the button; the active option is announced via aria-activedescendant.
 */
export function Select<T extends string>({ value, options, onChange, labelledBy }: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const selected = options[selectedIndex];

  const show = () => {
    setActive(selectedIndex);
    setOpen(true);
  };

  const choose = (index: number) => {
    setOpen(false);
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
  };

  // Outside click closes without choosing.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        show();
      }
      return;
    }
    const next = stepIndex(e.key, active, options.length);
    if (next !== null) {
      e.preventDefault();
      setActive(next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      // Only the popover closes; the settings view stays.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={labelledBy}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-7 min-w-40 items-center justify-between gap-3 rounded-md border bg-elevated pr-2 pl-2.5 text-xs text-fg transition-[border-color,background-color,box-shadow] duration-base ease-out-quint",
          "focus-visible:shadow-halo focus-visible:outline-none",
          open
            ? "border-fg-subtle/60 shadow-halo"
            : "border-border-strong hover:border-fg-subtle/40 hover:bg-hover",
        )}
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronsUpDown size={13} strokeWidth={1.75} className="text-fg-subtle" aria-hidden />
      </button>

      {open && (
        <div
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={labelledBy}
          className="absolute top-full right-0 z-30 mt-1.5 min-w-full origin-top-right rounded-md border border-border-strong bg-elevated p-1 shadow-2xl shadow-black/80 transition-[opacity,scale] duration-base ease-out-quint starting:scale-[.97] starting:opacity-0"
        >
          {options.map((option, i) => {
            const isSelected = i === selectedIndex;
            return (
              <div
                key={option.value}
                id={`${id}-${i}`}
                role="option"
                aria-selected={isSelected}
                onPointerMove={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                className={cn(
                  "flex h-7 items-center gap-2 rounded-sm pr-2.5 pl-2 text-xs whitespace-nowrap transition-colors duration-fast",
                  i === active ? "bg-hover text-fg" : "text-fg-muted",
                )}
              >
                <Check
                  size={13}
                  strokeWidth={2}
                  aria-hidden
                  className={cn("shrink-0", isSelected ? "text-fg" : "invisible")}
                />
                <span className="flex-1">{option.label}</span>
                {option.hint && <span className="pl-4 text-2xs text-fg-subtle">{option.hint}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
