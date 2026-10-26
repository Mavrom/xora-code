import type { ReactNode } from "react";
import { cn } from "@/shared/ui/cn";

interface CollapseProps {
  open: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Height animation without measuring: a one-row grid eases between 0fr and 1fr. Closed
 * content stays mounted but `inert`, so it is skipped by focus and screen readers.
 */
export function Collapse({ open, id, className, children }: CollapseProps) {
  return (
    <div
      id={id}
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-slow ease-out-quint",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className={cn("min-h-0 overflow-hidden", className)}>{children}</div>
    </div>
  );
}
