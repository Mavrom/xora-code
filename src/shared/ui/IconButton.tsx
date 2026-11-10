import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";
import { describeShortcut, detectPlatform } from "./keys";

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
  /** `md` (28px) by default; `sm` (24px) for dense row actions. */
  size?: "sm" | "md";
  /** Shortcut in portable form (`"alt+c"`): added to the tooltip and `aria-keyshortcuts`. */
  shortcut?: string;
}

const PLATFORM = detectPlatform(typeof navigator === "undefined" ? undefined : navigator);

export function IconButton({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
  variant = "ghost",
  size = "md",
  shortcut,
}: IconButtonProps) {
  const keys = shortcut ? describeShortcut(shortcut, PLATFORM) : undefined;
  return (
    <button
      type="button"
      aria-label={label}
      title={keys ? `${label} (${keys})` : label}
      aria-keyshortcuts={keys}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-fast",
        size === "md" ? "size-7" : "size-6",
        "disabled:cursor-not-allowed",
        variant === "ghost" &&
          (active
            ? "bg-elevated text-fg"
            : "text-fg-subtle hover:bg-hover hover:text-fg disabled:hover:bg-transparent disabled:hover:text-fg-subtle"),
        variant === "solid" &&
          "bg-accent text-accent-fg hover:bg-fg disabled:bg-hover disabled:text-fg-subtle",
      )}
    >
      <Icon size={size === "md" ? 16 : 14} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
