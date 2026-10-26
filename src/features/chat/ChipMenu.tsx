import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/shared/ui/cn";

export interface ChipOption {
  value: string;
  name: string;
  description?: string | null;
  group?: string;
  /** Small leading mark (e.g. an agent status dot). */
  leading?: ReactNode;
  /** Quiet text on the right (e.g. "Kurulu değil"). */
  meta?: string;
}

interface ChipMenuProps {
  /** Accessible name and popover heading, e.g. "Model". */
  label: string;
  value: string;
  options: ChipOption[];
  onSelect: (value: string) => void;
  /** Text inside the chip; defaults to the current option's name. */
  display?: ReactNode;
  leading?: ReactNode;
  /** Opens on mount (fixture screenshots). */
  defaultOpen?: boolean;
  /** Popover edge: chips on the left of a bar open rightwards, header buttons leftwards. */
  align?: "start" | "end";
  /** Direction of the popover; composer chips open upwards. */
  side?: "top" | "bottom";
  className?: string;
}

/**
 * A small text chip that opens a listbox popover: the composer's agent, model, mode and
 * effort selectors. Keyboard: arrows/Home/End move, Enter/Space pick, Esc/Tab close.
 */
export function ChipMenu({
  label,
  value,
  options,
  onSelect,
  display,
  leading,
  defaultOpen = false,
  align = "start",
  side = "top",
  className,
}: ChipMenuProps) {
  const id = useId();
  const listId = `${id}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const currentIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const [active, setActive] = useState(currentIndex);
  const current = options[currentIndex];

  const show = () => {
    setActive(currentIndex);
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  // Focus the list when it opens; close on any pointer down outside.
  useEffect(() => {
    if (!open) return;
    listRef.current?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the active row in view while moving with the keyboard.
  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);

  const pick = (index: number) => {
    const option = options[index];
    close(true);
    if (option && option.value !== value) onSelect(option.value);
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = options.length - 1;
    const moves: Record<string, () => number> = {
      ArrowDown: () => (active >= last ? 0 : active + 1),
      ArrowUp: () => (active <= 0 ? last : active - 1),
      Home: () => 0,
      End: () => last,
    };
    if (moves[event.key]) {
      event.preventDefault();
      setActive(moves[event.key]());
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pick(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${current?.name ?? value}`}
        title={label}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            show();
          }
        }}
        className={cn(
          "inline-flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-xs transition-colors duration-fast",
          open ? "bg-elevated text-fg" : "text-fg-muted hover:bg-hover hover:text-fg",
        )}
      >
        {leading}
        <span className="min-w-0 truncate">{display ?? current?.name ?? value}</span>
        <ChevronDown
          size={12}
          strokeWidth={1.75}
          aria-hidden
          className={cn(
            "shrink-0 text-fg-subtle transition-transform duration-base ease-out-quint",
            open && side === "top" && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onListKeyDown}
          className={cn(
            "absolute z-30 max-h-80 w-max max-w-80 min-w-56 overflow-y-auto rounded-lg border border-border-strong bg-elevated p-1 shadow-2xl shadow-black/70 outline-none",
            "transition-[opacity,translate] duration-base ease-out-quint starting:opacity-0",
            side === "top"
              ? "bottom-full mb-1.5 starting:translate-y-1"
              : "top-full mt-1.5 starting:-translate-y-1",
            align === "start" ? "left-0" : "right-0",
          )}
        >
          <div className="px-2.5 pt-1.5 pb-1 text-3xs font-medium tracking-wide text-fg-subtle uppercase">
            {label}
          </div>
          {options.map((option, index) => {
            const selected = option.value === value;
            const showGroup = option.group && option.group !== options[index - 1]?.group;
            return (
              <Fragment key={option.value}>
                {showGroup && (
                  <div
                    role="presentation"
                    className="mt-1 border-t border-border px-2.5 pt-2 pb-1 text-3xs text-fg-subtle"
                  >
                    {option.group}
                  </div>
                )}
                <div
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={selected}
                  onPointerMove={index === active ? undefined : () => setActive(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(index)}
                  className={cn(
                    "flex min-h-8 cursor-default items-center gap-2.5 rounded-md px-2.5 py-1.5 transition-colors duration-100",
                    index === active ? "bg-hover" : "",
                  )}
                >
                  {option.leading}
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-xs",
                        selected || index === active ? "text-fg" : "text-fg-muted",
                      )}
                    >
                      {option.name}
                    </span>
                    {option.description && (
                      <span className="mt-px block text-2xs leading-4 text-fg-subtle">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {option.meta && (
                    <span className="shrink-0 text-2xs text-fg-subtle">{option.meta}</span>
                  )}
                  <Check
                    size={13}
                    strokeWidth={2}
                    aria-hidden
                    className={cn("shrink-0 text-fg", selected ? "opacity-100" : "opacity-0")}
                  />
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
