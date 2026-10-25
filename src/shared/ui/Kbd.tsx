import { cn } from "./cn";
import { describeShortcut, detectPlatform, formatShortcut } from "./keys";

const PLATFORM = detectPlatform(typeof navigator === "undefined" ? undefined : navigator);

interface KbdProps {
  /** Shortcut in portable form, e.g. `"mod+k"`, `"shift+enter"`; `mod` is ⌘ on macOS, Ctrl elsewhere. */
  keys: string;
  className?: string;
}

/** Platform-aware key caps for inline shortcut hints. */
export function Kbd({ keys, className }: KbdProps) {
  const caps = formatShortcut(keys, PLATFORM);
  return (
    <kbd className={cn("inline-flex items-center gap-0.5 align-middle font-sans", className)}>
      <span className="sr-only">{describeShortcut(keys, PLATFORM)}</span>
      {caps.map((cap, index) => (
        <span
          key={`${cap.label}-${index}`}
          aria-hidden
          className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-xs border border-border-strong bg-elevated px-1 text-3xs font-medium text-fg-muted shadow-[inset_0_-1px_0_var(--color-border-strong)]"
        >
          {cap.label}
        </span>
      ))}
    </kbd>
  );
}
