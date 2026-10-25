import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** `primary`: white on black, one per view. `secondary`: elevated with a border. `ghost`: bare. */
  variant?: ButtonVariant;
  /** `md` (28px) by default; `sm` (24px) for dense rows. */
  size?: "sm" | "md";
  /** Optional leading icon. */
  icon?: LucideIcon;
  /** Optional trailing slot, typically a `<Kbd>`. */
  trailing?: ReactNode;
  children: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-fg hover:bg-fg active:bg-fg-muted disabled:bg-hover disabled:text-fg-subtle",
  secondary:
    "border border-border-strong bg-elevated text-fg hover:border-fg-subtle/40 hover:bg-hover active:bg-elevated disabled:border-border disabled:bg-surface disabled:text-fg-subtle",
  ghost:
    "text-fg-muted hover:bg-hover hover:text-fg active:bg-elevated disabled:text-fg-subtle disabled:hover:bg-transparent",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  trailing,
  children,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap select-none",
        "transition-[background-color,border-color,color,box-shadow] duration-fast ease-out-quint",
        // Outline sits just outside the edge so it reads on every variant, white primary included.
        "focus-visible:shadow-halo focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-muted disabled:cursor-not-allowed",
        size === "md" ? "h-7 px-3 text-xs" : "h-6 px-2 text-2xs",
        VARIANTS[variant],
        className,
      )}
    >
      {Icon && <Icon size={size === "md" ? 14 : 12} strokeWidth={1.75} aria-hidden />}
      {children}
      {trailing && <span className="-mr-1 ml-0.5 inline-flex items-center">{trailing}</span>}
    </button>
  );
}
