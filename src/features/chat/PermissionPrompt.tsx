import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { ShieldQuestion } from "lucide-react";
import type { AcpPermissionOption } from "@/features/agents/types";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/ui/cn";
import { Kbd } from "@/shared/ui/Kbd";
import type { PendingPermission } from "@/features/agents/reducer";
import { DiffPreview } from "./DiffPreview";
import { defaultAllow, defaultReject, toolDiffs, toolText } from "./toolView";

interface PermissionPromptProps {
  request: PendingPermission;
  /** Requests still waiting behind this one. */
  queued: number;
  onRespond: (requestId: string, optionId: string | null) => void;
}

/** Command an execute call wants to run, when the agent sent it as raw input. */
function commandOf(rawInput: unknown): string | null {
  if (rawInput && typeof rawInput === "object" && "command" in rawInput) {
    const command = (rawInput as { command: unknown }).command;
    if (typeof command === "string") return command;
    if (Array.isArray(command)) return command.join(" ");
  }
  return null;
}

/**
 * The agent asks before acting. Shows what will happen (diff, command or text) and the
 * agent's own options; Enter takes the first allow, Esc the one-time reject. Focus stays
 * inside the card until it is answered.
 */
export function PermissionPrompt({ request, queued, onRespond }: PermissionPromptProps) {
  const titleId = useId();
  const descId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const { toolCall, options } = request;
  const allow = defaultAllow(options);
  const reject = defaultReject(options);
  const diffs = toolDiffs(toolCall);
  const command = commandOf(toolCall.rawInput);
  const text = toolText(toolCall);

  // A new request takes focus so the keyboard answer works immediately.
  useEffect(() => {
    cardRef.current?.querySelector<HTMLButtonElement>("[data-primary]")?.focus();
  }, [request.requestId]);

  const pick = (option: AcpPermissionOption | null) => {
    if (option) onRespond(request.requestId, option.optionId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      pick(reject);
    } else if (event.key === "Enter" && event.target === event.currentTarget) {
      event.preventDefault();
      pick(allow);
    } else if (event.key === "Tab") {
      trapFocus(event);
    }
  };

  return (
    <div
      ref={cardRef}
      role="alertdialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="rounded-xl border border-border-strong bg-surface shadow-halo outline-none transition-[opacity,translate] duration-base ease-out-quint starting:translate-y-1 starting:opacity-0"
    >
      <div className="flex items-start gap-3 px-3.5 pt-3">
        <span className="mt-px grid size-7 shrink-0 place-items-center rounded-md border border-border bg-elevated text-fg-muted shadow-well">
          <ShieldQuestion size={15} strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p id={titleId} className="text-ui font-medium text-fg">
            İzin gerekiyor
            {queued > 0 && (
              <span className="ml-2 text-2xs font-normal text-fg-subtle">+{queued} bekliyor</span>
            )}
          </p>
          <p
            id={descId}
            className="mt-0.5 truncate text-xs text-fg-muted"
            title={toolCall.title ?? ""}
          >
            {toolCall.title ?? "Agent bir işlem yapmak istiyor."}
          </p>
        </div>
      </div>

      {(diffs.length > 0 || command || text) && (
        <div className="mt-3 flex max-h-[38vh] flex-col gap-2 overflow-y-auto px-3.5">
          {diffs.map((diff) => (
            <DiffPreview
              key={diff.path}
              path={diff.path}
              oldText={diff.oldText}
              newText={diff.newText}
              maxRows={40}
            />
          ))}
          {command && (
            <pre className="rounded-lg border border-border bg-bg px-3 py-2 font-mono text-2xs leading-[18px] whitespace-pre-wrap text-fg select-text">
              <span className="text-fg-subtle select-none">$ </span>
              {command}
            </pre>
          )}
          {!command && diffs.length === 0 && text && (
            <p className="text-xs whitespace-pre-wrap text-fg-muted">{text}</p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border px-3.5 py-2.5">
        {options.map((option) => {
          const isAllow = option === allow;
          const isReject = option === reject;
          return (
            <Button
              key={option.optionId}
              data-primary={isAllow || undefined}
              variant={
                isAllow ? "primary" : option.kind.startsWith("allow") ? "secondary" : "ghost"
              }
              onClick={() => pick(option)}
              trailing={
                isAllow ? (
                  <Kbd
                    keys="enter"
                    className={cn(
                      "[&>span]:border-accent-fg/20 [&>span]:bg-transparent [&>span]:text-accent-fg/70 [&>span]:shadow-none",
                    )}
                  />
                ) : isReject ? (
                  <Kbd keys="escape" />
                ) : undefined
              }
            >
              {option.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/** Keeps Tab and Shift+Tab cycling inside the card. */
function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
  const focusable = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
    ),
  ];
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
