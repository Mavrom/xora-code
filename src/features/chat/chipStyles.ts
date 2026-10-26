import { cn } from "@/shared/ui/cn";

export type ChipTone = "quiet" | "outline";

/** Shared look of composer chips: `quiet` inside the composer, `outline` in the row under it. */
export const chipClass = (open: boolean, tone: ChipTone) =>
  cn(
    "inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-lg px-2.5 text-xs transition-[background-color,border-color,color] duration-fast ease-out-quint",
    tone === "outline" && "border",
    open
      ? cn("text-fg", tone === "outline" ? "border-glass-border bg-glass-strong" : "bg-hover")
      : cn(
          "text-fg-muted hover:text-fg",
          tone === "outline"
            ? "border-transparent hover:border-glass-border hover:bg-glass"
            : "hover:bg-hover",
        ),
  );
