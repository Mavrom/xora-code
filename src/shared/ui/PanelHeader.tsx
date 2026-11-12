import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "./cn";
import { IconButton } from "./IconButton";

/** A way out of the panel, shown before its title. */
export interface PanelBack {
  label: string;
  onClick: () => void;
  /** Shortcut in portable form (`"ctrl+shift+h"`), for the tooltip. */
  shortcut?: string;
}

interface PanelHeaderProps {
  title: string;
  actions?: ReactNode;
  back?: PanelBack;
}

export function PanelHeader({ title, actions, back }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center justify-between gap-2 pr-1.5",
        back ? "pl-1.5" : "pl-3.5",
      )}
    >
      <div className="flex min-w-0 items-center gap-1">
        {back && (
          <IconButton
            icon={ArrowLeft}
            label={back.label}
            size="sm"
            shortcut={back.shortcut}
            onClick={back.onClick}
          />
        )}
        <h2 className="truncate text-xs text-fg-subtle">{title}</h2>
      </div>
      {actions && <div className="flex items-center gap-0.5">{actions}</div>}
    </div>
  );
}
