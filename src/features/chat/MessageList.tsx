import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, CircleAlert } from "lucide-react";
import { canBranch } from "@/features/agents/branch";
import type { ChatItem, SessionView } from "@/features/agents/reducer";
import type { AcpStopReason } from "@/features/agents/types";
import { cn } from "@/shared/ui/cn";
import { Item } from "./MessageItem";
import { gapBefore, isNearBottom } from "./scroll";
import { imageKey, toolImages } from "./toolView";
import { createRunGrouper } from "./toolRuns";
import { ToolRunGroup } from "./ToolRunGroup";
import { t } from "@/shared/i18n";

const NONE: ReadonlySet<string> = new Set();

const STOP_NOTE: Partial<Record<AcpStopReason, string>> = {
  cancelled: "Durduruldu.",
  max_tokens: t("The reply hit its length limit."),
  max_turn_requests: t("This turn hit its request limit."),
  refusal: t("The agent declined this request."),
};

interface MessageListProps {
  session: SessionView;
  /** "Edit and retry" on a user message (its item id); offered while nothing runs. */
  onEditAndRetry?: (itemId: string) => void;
}

/**
 * The transcript. Follows the stream while the reader is at the bottom and lets go as soon
 * as they scroll up (a "jump to latest" button brings them back). Screen readers get the
 * finished turn, not every chunk: the log is `aria-busy` while the agent works.
 */
export function MessageList({ session, onEditAndRetry }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // A stable callback, so offering the action does not re-render every row.
  const editRef = useRef(onEditAndRetry);
  useLayoutEffect(() => {
    editRef.current = onEditAndRetry;
  });
  const onEdit = useCallback((itemId: string) => editRef.current?.(itemId), []);
  const editable = onEditAndRetry !== undefined && canBranch(session);
  const contentRef = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);
  const [detached, setDetached] = useState(false);
  const { items, turn, terminals } = session;
  const running = turn !== "idle";
  const last = items[items.length - 1];
  const shown = useShownImages(items);
  const permissions = useMemo(
    () => new Set(session.permissions.map((p) => p.toolCall.toolCallId)),
    [session.permissions],
  );
  const [groupRuns] = useState(createRunGrouper);
  const rows = useMemo(
    () => groupRuns(items, { live: running, permissions }),
    [groupRuns, items, running, permissions],
  );
  // Expanded runs by first call id: survives streaming updates and the run growing.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(NONE);
  const toggleRun = useCallback(
    (id: string) => {
      const next = new Set(expanded);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        // The reader opened a run to read it: stop following the stream so it stays in place.
        stuck.current = false;
      }
      setExpanded(next);
    },
    [expanded],
  );

  // A different session starts pinned to its latest message.
  useLayoutEffect(() => {
    stuck.current = true;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [session.sessionId]);

  // Any growth of the content (chunks, expanding cards) keeps a pinned view at the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const observer = new ResizeObserver(() => {
      if (stuck.current) el.scrollTop = el.scrollHeight;
      else setDetached(!isNearBottom(el));
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stuck.current = isNearBottom(el);
    setDetached(!stuck.current);
  };

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    stuck.current = true;
    setDetached(false);
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  const working = running && !isProgressVisible(last);
  const stopNote = !running && session.lastStopReason ? STOP_NOTE[session.lastStopReason] : null;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-label={t("Chat")}
        aria-live="polite"
        aria-busy={running || session.loading}
        className="h-full overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]"
      >
        <div ref={contentRef} className="mx-auto w-full max-w-180 px-6 pt-6 pb-10">
          {session.loading && items.length === 0 && <ReplaySkeleton />}
          {rows.map((row, index) => {
            const prev = rows[index - 1];
            const gap = gapBefore(
              prev && (prev.kind === "run" ? "tool" : prev.item.kind),
              row.kind === "run" ? "tool" : row.item.kind,
            );
            if (row.kind === "run") {
              return (
                <div key={`run-${row.id}`} className={gap}>
                  <ToolRunGroup
                    run={row}
                    open={expanded.has(row.id)}
                    onToggle={toggleRun}
                    terminals={terminals}
                  />
                </div>
              );
            }
            const { item } = row;
            return (
              <div key={item.id} className={gap}>
                <Item
                  item={item}
                  streaming={running && item === last}
                  terminals={terminals}
                  shown={item.kind === "agent" ? shown : undefined}
                  onEdit={item.kind === "user" && editable ? onEdit : undefined}
                />
              </div>
            );
          })}
          {working && (
            <p className="mt-4 text-xs">
              <span className="shimmer">{t("Working…")}</span>
            </p>
          )}
          {stopNote && <p className="mt-3 text-2xs text-fg-subtle">{stopNote}</p>}
          {session.error && !running && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-lg border border-border-strong bg-glass px-3 py-2.5 text-xs"
            >
              <CircleAlert
                size={14}
                strokeWidth={1.75}
                aria-hidden
                className="mt-0.5 shrink-0 text-danger"
              />
              <p className="min-w-0 text-fg-muted">
                <span className="text-fg">{t("The turn could not finish.")}</span>{" "}
                {session.error.message}
              </p>
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={jumpToLatest}
        aria-hidden={!detached}
        tabIndex={detached ? 0 : -1}
        className={cn(
          "absolute bottom-3 left-1/2 inline-flex h-7 -translate-x-1/2 items-center gap-1.5 rounded-full border border-glass-border bg-glass-strong px-3 text-2xs text-fg-muted shadow-lg shadow-black/40 backdrop-blur-xl transition-[opacity,translate] duration-base ease-out-quint hover:text-fg",
          detached ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0",
        )}
      >
        <ArrowDown size={12} strokeWidth={1.75} aria-hidden />
        {t("Jump to bottom")}
      </button>
    </div>
  );
}

/** The last item already shows progress itself (streaming text, live thought, running tool). */
function isProgressVisible(item: ChatItem | undefined): boolean {
  if (!item) return false;
  if (item.kind === "agent") return item.text.length > 0;
  if (item.kind === "thought") return item.endedAt === null;
  if (item.kind === "tool")
    return item.call.status === "pending" || item.call.status === "in_progress";
  return false;
}

/**
 * Pictures tool cards already show, as a set that only changes identity when the list
 * does (so agent rows are not re-rendered on every streamed chunk).
 */
function useShownImages(items: readonly ChatItem[]): ReadonlySet<string> {
  const keys = items
    .flatMap((i) =>
      i.kind === "tool"
        ? toolImages(i.call).flatMap((m) => (m.path ? [imageKey(m.path)] : []))
        : [],
    )
    .join("|");
  return useMemo(() => new Set(keys ? keys.split("|") : []), [keys]);
}

function ReplaySkeleton() {
  return (
    <div aria-label={t("Loading session")} className="flex flex-col gap-3">
      <div className="skeleton ml-auto h-9 w-2/5 animate-skeleton rounded-2xl" />
      <div className="skeleton h-3 w-4/5 animate-skeleton rounded-full" />
      <div className="skeleton h-3 w-3/5 animate-skeleton rounded-full" />
      <div className="skeleton h-3 w-2/3 animate-skeleton rounded-full" />
    </div>
  );
}
