import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";

interface IconButtonProps {
  icon: LucideIcon;
  /** Accessible name; also shown as the native tooltip. */
  label: string;
  onClick?: () => void;
  /** Toggle state. When provided, the button exposes `aria-pressed`. */
  active?: boolean;
  disabled?: boolean;
  /** `ghost` for toolbars, `solid` for a primary action (e.g. send). */
  variant?: "ghost" | "solid";
}

export function IconButton({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
  variant = "ghost",
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
        "disabled:cursor-not-allowed",
        variant === "ghost" &&
          (active
            ? "bg-elevated text-fg"
            : "text-fg-subtle hover:bg-hover hover:text-fg disabled:hover:bg-transparent disabled:hover:text-fg-subtle"),
        variant === "solid" &&
          "bg-accent text-accent-fg hover:bg-fg disabled:bg-hover disabled:text-fg-subtle",
      )}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
