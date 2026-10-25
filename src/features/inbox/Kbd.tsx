import type { ReactNode } from "react";

/** Tiny key cap for inline shortcut hints. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-[4px] border border-border-strong bg-surface px-1 font-sans text-[10px] leading-none font-medium text-fg-muted">
      {children}
    </kbd>
  );
}
