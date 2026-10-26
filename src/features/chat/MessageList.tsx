import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, CircleAlert, FileText, Info, TriangleAlert } from "lucide-react";
import type { ChatItem, SessionView } from "@/features/agents/reducer";
import type { AcpContentBlock, AcpStopReason } from "@/features/agents/types";
import { cn } from "@/shared/ui/cn";
import { Markdown } from "./Markdown";
import { PlanView } from "./PlanView";
import { gapBefore, isNearBottom } from "./scroll";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallCard } from "./ToolCallCard";
import { fileName, imageKey, messageImagePaths, toolImages, type ToolImage } from "./toolView";
import { ToolImages } from "./ToolImages";
import { dataUrl } from "./attachments";

const NONE: ReadonlySet<string> = new Set();

const STOP_NOTE: Partial<Record<AcpStopReason, string>> = {
  cancelled: "Durduruldu.",
  max_tokens: "Yanıt uzunluk sınırına ulaştı.",
  max_turn_requests: "Bu tur için istek sınırına ulaşıldı.",
  refusal: "Agent bu isteği yanıtlamadı.",
};

interface MessageListProps {
  session: SessionView;
}

/**
 * The transcript. Follows the stream while the reader is at the bottom and lets go as soon
 * as they scroll up (a "jump to latest" button brings them back). Screen readers get the
 * finished turn, not every chunk: the log is `aria-busy` while the agent works.
 */
export function MessageList({ session }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);
  const [detached, setDetached] = useState(false);
  const { items, turn, terminals } = session;
  const running = turn !== "idle";
  const last = items[items.length - 1];
  const shown = useShownImages(items);

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
        aria-label="Sohbet"
        aria-live="polite"
        aria-busy={running || session.loading}
        className="h-full overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]"
      >
        <div ref={contentRef} className="mx-auto w-full max-w-180 px-6 pt-6 pb-10">
          {session.loading && items.length === 0 && <ReplaySkeleton />}
          {items.map((item, index) => (
            <div key={item.id} className={gapBefore(items[index - 1]?.kind, item.kind)}>
              <Item
                item={item}
                streaming={running && item === last}
                terminals={terminals}
                shown={item.kind === "agent" ? shown : undefined}
              />
            </div>
          ))}
          {working && (
            <p className="mt-4 text-xs">
              <span className="shimmer">Çalışıyor…</span>
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
                <span className="text-fg">Tur tamamlanamadı.</span> {session.error.message}
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
        En alta git
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

/** An agent reply, plus the local pictures it points at that no tool card has shown. */
function AgentMessage({
  text,
  streaming,
  shown,
}: {
  text: string;
  streaming: boolean;
  shown: ReadonlySet<string>;
}) {
  const images = useMemo<ToolImage[]>(
    () =>
      streaming
        ? []
        : messageImagePaths(text)
            .filter((path) => !shown.has(imageKey(path)))
            .map((path, i) => ({ key: `msg-${i}`, kind: "file", path })),
    [text, streaming, shown],
  );
  return (
    <>
      <Markdown text={text} streaming={streaming} />
      {images.length > 0 && <ToolImages images={images} inset={false} />}
    </>
  );
}

const Item = memo(function Item({
  item,
  streaming,
  terminals,
  shown,
}: {
  item: ChatItem;
  streaming: boolean;
  terminals: SessionView["terminals"];
  shown?: ReadonlySet<string>;
}) {
  switch (item.kind) {
    case "user":
      return <UserMessage blocks={item.blocks} />;
    case "agent":
      return <AgentMessage text={item.text} streaming={streaming} shown={shown ?? NONE} />;
    case "thought":
      return (
        <ThinkingBlock
          text={item.text}
          active={streaming && item.endedAt === null}
          startedAt={item.startedAt}
          endedAt={item.endedAt}
        />
      );
    case "tool":
      return (
        <ToolCallCard
          call={item.call}
          startedAt={item.startedAt}
          endedAt={item.endedAt}
          terminals={terminals}
        />
      );
    case "plan":
      return <PlanView entries={item.entries} />;
    case "notice":
      return <NoticeRow severity={item.severity} title={item.title} />;
  }
});

function UserMessage({ blocks }: { blocks: AcpContentBlock[] }) {
  const text = blocks
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("\n")
    .trim();
  const files = blocks.flatMap((b) =>
    b.type === "resource_link" ? [b.name || b.uri] : b.type === "resource" ? [b.resource.uri] : [],
  );
  const images = blocks.flatMap((b) => (b.type === "image" ? [b] : []));
  return (
    <div className="flex flex-col items-end gap-1.5">
      {images.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
          {images.map((img, i) => (
            <img
              key={i}
              src={dataUrl(img.mimeType, img.data)}
              alt="Eklenen görsel"
              className="max-h-48 max-w-72 rounded-xl border border-glass-border object-cover"
            />
          ))}
        </div>
      )}
      {(text || files.length > 0) && (
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-glass-border bg-glass-strong px-4 py-2.5 text-ui leading-[22px] whitespace-pre-wrap text-fg backdrop-blur-xl select-text [overflow-wrap:anywhere]">
          {text}
          {files.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {files.map((file) => (
                <span
                  key={file}
                  className="inline-flex h-5 items-center gap-1 rounded-md border border-glass-border px-1.5 font-mono text-3xs text-fg-muted"
                >
                  <FileText size={10} strokeWidth={1.75} aria-hidden />
                  {fileName(file)}
                </span>
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function NoticeRow({ severity, title }: { severity: string; title: string }) {
  const Icon = severity === "error" ? CircleAlert : severity === "warning" ? TriangleAlert : Info;
  return (
    <p className="flex items-center gap-2 text-2xs text-fg-subtle">
      <Icon
        size={12}
        strokeWidth={1.75}
        aria-hidden
        className={cn(
          severity === "error" && "text-danger",
          severity === "warning" && "text-warning",
        )}
      />
      {title}
    </p>
  );
}

function ReplaySkeleton() {
  return (
    <div aria-label="Oturum yükleniyor" className="flex flex-col gap-3">
      <div className="skeleton ml-auto h-9 w-2/5 animate-skeleton rounded-2xl" />
      <div className="skeleton h-3 w-4/5 animate-skeleton rounded-full" />
      <div className="skeleton h-3 w-3/5 animate-skeleton rounded-full" />
      <div className="skeleton h-3 w-2/3 animate-skeleton rounded-full" />
    </div>
  );
}
