import { memo, useId, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Brain,
  Check,
  ChevronRight,
  FileText,
  Globe,
  PencilLine,
  Search,
  SquareTerminal,
  ToggleRight,
  Trash2,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import type { AcpToolCall, AcpToolKind } from "@/features/agents/types";
import { cn } from "@/shared/ui/cn";
import type { TerminalView } from "./stub/types";
import { Collapse } from "./Disclosure";
import { DiffPreview, DiffStat } from "./DiffPreview";
import { diffLines, diffStats } from "./diff";
import { revealInEditor } from "./editorBridge";
import { formatDuration } from "./format";
import {
  fileName,
  opensByDefault,
  terminalPreview,
  toolDiffs,
  toolTerminals,
  toolText,
} from "./toolView";

const KIND_ICON: Record<AcpToolKind, LucideIcon> = {
  read: FileText,
  edit: PencilLine,
  delete: Trash2,
  move: ArrowRightLeft,
  search: Search,
  execute: SquareTerminal,
  think: Brain,
  fetch: Globe,
  switch_mode: ToggleRight,
  other: Wrench,
};

interface ToolCallCardProps {
  call: AcpToolCall;
  startedAt: number;
  endedAt: number | null;
  terminals: Record<string, TerminalView>;
}

/**
 * One tool step: a quiet single-line header (kind icon, title, status, duration) that
 * expands into its diff, terminal output, text result and file locations.
 */
export const ToolCallCard = memo(function ToolCallCard({
  call,
  startedAt,
  endedAt,
  terminals,
}: ToolCallCardProps) {
  const bodyId = useId();
  // Until the user toggles it, the card follows the call: an edit opens once its diff arrives.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? opensByDefault(call);
  const Icon = KIND_ICON[call.kind ?? "other"] ?? Wrench;
  const status = call.status ?? "pending";
  const failed = status === "failed";
  const running = status === "pending" || status === "in_progress";

  const diffs = useMemo(() => toolDiffs(call), [call]);
  const terminalIds = toolTerminals(call);
  const text = toolText(call);
  const locations = call.locations ?? [];
  const hasBody =
    diffs.length > 0 || terminalIds.length > 0 || text.length > 0 || locations.length > 1;
  const stats = useMemo(() => (diffs.length > 0 ? sumStats(diffs) : null), [diffs]);

  return (
    <div className="group/tool">
      <button
        type="button"
        aria-expanded={hasBody ? open : undefined}
        aria-controls={hasBody ? bodyId : undefined}
        onClick={() => hasBody && setToggled(!open)}
        className={cn(
          "-mx-2 flex h-8 w-[calc(100%+1rem)] min-w-0 items-center gap-2.5 rounded-md px-2 text-left text-xs transition-colors duration-fast",
          hasBody ? "hover:bg-hover" : "cursor-default",
        )}
      >
        <Icon
          size={14}
          strokeWidth={1.75}
          aria-hidden
          className={cn("shrink-0", failed ? "text-danger" : "text-fg-subtle")}
        />
        <span className={cn("min-w-0 truncate", running ? "text-fg" : "text-fg-muted")}>
          <ToolTitle title={call.title} />
        </span>
        {stats && <DiffStat {...stats} />}
        <span className="flex-1" />
        {endedAt !== null && !running && (
          <span className="shrink-0 text-2xs text-fg-subtle tabular-nums">
            {formatDuration(endedAt - startedAt)}
          </span>
        )}
        <StatusMark status={status} />
        {hasBody && (
          <ChevronRight
            size={13}
            strokeWidth={1.75}
            aria-hidden
            className={cn(
              "-mr-0.5 shrink-0 text-fg-subtle opacity-0 transition-[opacity,rotate] duration-base ease-out-quint group-hover/tool:opacity-100",
              open && "rotate-90 opacity-100",
            )}
          />
        )}
      </button>
      {hasBody && (
        <Collapse open={open} id={bodyId}>
          <div className="flex flex-col gap-2 pt-1 pb-2 pl-6">
            {diffs.map((diff) => (
              <DiffPreview
                key={diff.path}
                path={diff.path}
                oldText={diff.oldText}
                newText={diff.newText}
              />
            ))}
            {terminalIds.map((id) => (
              <TerminalOutput key={id} terminal={terminals[id]} />
            ))}
            {text && (
              <pre
                className={cn(
                  "max-h-60 overflow-auto rounded-lg border bg-surface px-3 py-2 font-mono text-2xs leading-[18px] whitespace-pre-wrap select-text",
                  failed ? "border-border-strong text-danger" : "border-border text-fg-muted",
                )}
              >
                {text}
              </pre>
            )}
            {locations.length > 1 && (
              <ul className="flex flex-wrap gap-1">
                {locations.map((loc) => (
                  <li key={`${loc.path}:${loc.line ?? ""}`}>
                    <LocationChip path={loc.path} line={loc.line ?? null} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Collapse>
      )}
    </div>
  );
});

function sumStats(diffs: ReturnType<typeof toolDiffs>) {
  let added = 0;
  let removed = 0;
  for (const d of diffs) {
    const s = diffStats(diffLines(d.oldText, d.newText));
    added += s.added;
    removed += s.removed;
  }
  return { added, removed };
}

/** Agent titles often wrap paths and commands in backticks; show those parts in mono. */
function ToolTitle({ title }: { title: string }) {
  const parts = title.split("`");
  if (parts.length < 3) return title;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <code key={i} className="font-mono text-[11.5px] text-fg">
        {part}
      </code>
    ) : (
      part
    ),
  );
}

function StatusMark({ status }: { status: NonNullable<AcpToolCall["status"]> }) {
  const label = {
    pending: "Bekliyor",
    in_progress: "Çalışıyor",
    completed: "Tamamlandı",
    failed: "Başarısız",
  }[status];
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="grid size-3.5 shrink-0 place-items-center"
    >
      {status === "pending" && <span className="size-1.5 rounded-full border border-fg-subtle" />}
      {status === "in_progress" && (
        <span className="size-3 animate-spin rounded-full border-[1.5px] border-border-strong border-t-fg motion-reduce:animate-none" />
      )}
      {status === "completed" && <Check size={13} strokeWidth={2} className="text-fg-subtle" />}
      {status === "failed" && <X size={13} strokeWidth={2} className="text-danger" />}
    </span>
  );
}

function LocationChip({ path, line }: { path: string; line: number | null }) {
  return (
    <button
      type="button"
      title={path}
      onClick={() => revealInEditor(path, line)}
      className="inline-flex h-6 items-center rounded-md border border-border bg-surface px-2 font-mono text-2xs text-fg-muted transition-colors duration-fast hover:border-border-strong hover:text-fg"
    >
      {fileName(path)}
      {line != null && <span className="text-fg-subtle">:{line}</span>}
    </button>
  );
}

/** Live command output: the last 12 lines, expandable to all of it. */
function TerminalOutput({ terminal }: { terminal: TerminalView | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const preview = terminalPreview(terminal?.output ?? "", 12, expanded);
  const exited = terminal?.exited ?? false;
  const code = terminal?.exitCode ?? null;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg">
      {preview.hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex h-7 w-full items-center border-b border-border px-3 text-2xs text-fg-subtle transition-colors duration-fast hover:bg-hover hover:text-fg"
        >
          Tümü · {preview.hidden} satır daha
        </button>
      )}
      <pre className="max-h-80 overflow-auto px-3 py-2 font-mono text-2xs leading-[18px] whitespace-pre-wrap text-fg-muted select-text">
        {preview.lines.length > 0 ? preview.lines.join("\n") : exited ? "Çıktı yok." : "…"}
      </pre>
      {exited && (
        <div className="flex h-6 items-center border-t border-border px-3 text-3xs text-fg-subtle">
          {code === 0 ? "Çıkış kodu 0" : code === null ? "Sonlandırıldı" : `Çıkış kodu ${code}`}
        </div>
      )}
    </div>
  );
}
