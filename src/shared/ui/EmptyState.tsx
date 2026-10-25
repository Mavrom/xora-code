import type { LucideIcon } from "lucide-react";
import { isValidElement, type ReactNode } from "react";
import { Button, type ButtonVariant } from "./Button";
import { cn } from "./cn";
import { Kbd } from "./Kbd";

/** Declarative call to action, rendered as a `Button` (with an optional shortcut cap). */
export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  /** Portable shortcut shown inside the button, e.g. `"mod+o"`. */
  shortcut?: string;
  variant?: ButtonVariant;
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Call to action under the text: an `EmptyStateAction`, or any custom node. */
  action?: ReactNode | EmptyStateAction;
  /** Quiet line at the bottom, typically a shortcut hint with `<Kbd>`. */
  hint?: ReactNode;
}

function isActionObject(action: EmptyStateProps["action"]): action is EmptyStateAction {
  return (
    typeof action === "object" && action !== null && !isValidElement(action) && "label" in action
  );
}

interface IconWellProps {
  icon: LucideIcon;
  /** `hero` is a touch larger and brighter, for the one focal well of a view (chat welcome). */
  size?: "default" | "hero";
  className?: string;
}

/** The sunken square that holds an empty state's icon; shared with the chat welcome. */
export function IconWell({ icon: Icon, size = "default", className }: IconWellProps) {
  const hero = size === "hero";
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg border border-border bg-linear-to-b from-bg to-surface shadow-well",
        hero ? "size-11 text-fg-muted" : "size-10 text-fg-subtle",
        className,
      )}
    >
      <Icon size={hero ? 20 : 18} strokeWidth={1.5} aria-hidden />
    </div>
  );
}

/**
 * Centred placeholder for an empty panel. The bottom padding lifts the block onto the
 * optical centre; every panel uses the same rhythm so empty states line up side by side.
 */
export function EmptyState({ icon, title, description, action, hint }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 pb-12 text-center">
      {icon && <IconWell icon={icon} className="mb-4" />}
      <p className="text-ui font-medium text-fg">{title}</p>
      {description && (
        <p className="mt-1 max-w-64 text-xs text-balance text-fg-muted">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          {isActionObject(action) ? (
            <Button
              variant={action.variant ?? "secondary"}
              icon={action.icon}
              onClick={action.onClick}
              trailing={action.shortcut ? <Kbd keys={action.shortcut} /> : undefined}
            >
              {action.label}
            </Button>
          ) : (
            action
          )}
        </div>
      )}
      {hint && <div className="mt-4 text-2xs text-fg-subtle">{hint}</div>}
    </div>
  );
}
