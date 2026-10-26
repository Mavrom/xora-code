import type { ReactNode } from "react";

interface PanelHeaderProps {
  title: string;
  actions?: ReactNode;
}

export function PanelHeader({ title, actions }: PanelHeaderProps) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between gap-2 pr-1.5 pl-3.5">
      <h2 className="truncate text-xs text-fg-subtle">{title}</h2>
      {actions && <div className="flex items-center gap-0.5">{actions}</div>}
    </div>
  );
}
