import { cn } from "@/shared/ui/cn";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Id of the visible label (the setting row's title). */
  labelledBy?: string;
  label?: string;
  disabled?: boolean;
}

/** On/off switch: white track with a black knob when on, a dim well when off. */
export function Toggle({ checked, onChange, labelledBy, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border transition-[background-color,border-color,box-shadow] duration-base ease-out-quint",
        "focus-visible:shadow-halo focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-muted",
        "disabled:cursor-not-allowed disabled:opacity-40",
        checked
          ? "border-fg bg-fg"
          : "border-border-strong bg-elevated shadow-well hover:border-fg-subtle/50",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 left-0.5 size-3 -translate-y-1/2 rounded-full transition-[translate,background-color] duration-base ease-out-quint",
          checked ? "translate-x-[14px] bg-bg" : "bg-fg-subtle",
        )}
      />
    </button>
  );
}
