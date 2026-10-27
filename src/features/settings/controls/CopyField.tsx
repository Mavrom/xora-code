import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { t } from "@/shared/i18n";

const COPIED_MS = 1600;

/** A read-only command in mono type with a copy button that confirms in place. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return; // Clipboard unavailable; the text stays selectable.
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-bg pr-1 pl-3 shadow-well">
      <span aria-hidden className="font-mono text-2xs text-fg-subtle select-none">
        $
      </span>
      <code className="min-w-0 flex-1 truncate font-mono text-2xs text-fg select-text">
        {value}
      </code>
      <button
        type="button"
        aria-label={copied ? t("Copied") : label}
        title={copied ? t("Copied") : label}
        onClick={() => void copy()}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-2xs transition-colors duration-fast",
          copied ? "text-fg" : "text-fg-subtle hover:bg-hover hover:text-fg",
        )}
      >
        {copied ? (
          <Check size={12} strokeWidth={2} aria-hidden />
        ) : (
          <Copy size={12} strokeWidth={1.75} aria-hidden />
        )}
        <span aria-live="polite">{copied ? t("Copied") : t("Copy")}</span>
      </button>
    </div>
  );
}
