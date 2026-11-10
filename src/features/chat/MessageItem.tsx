import { memo, useEffect, useMemo, useState } from "react";
import { Check, CircleAlert, Copy, FileText, Info, Pencil, TriangleAlert } from "lucide-react";
import type { ChatItem, SessionView } from "@/features/agents/reducer";
import type { AcpContentBlock } from "@/features/agents/types";
import { cn } from "@/shared/ui/cn";
import { Markdown } from "./Markdown";
import { PlanView } from "./PlanView";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallCard } from "./ToolCallCard";
import { fileName, imageKey, messageImagePaths, type ToolImage } from "./toolView";
import { ToolImages } from "./ToolImages";
import { dataUrl } from "./attachments";
import { t } from "@/shared/i18n";

const NONE: ReadonlySet<string> = new Set();

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
    <div className="group/reply relative">
      <Markdown text={text} streaming={streaming} />
      {images.length > 0 && <ToolImages images={images} inset={false} />}
      {!streaming && <CopyReply text={text} />}
    </div>
  );
}

/** Copies a finished reply as markdown; shows on hover under the text, without moving it. */
function CopyReply({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      aria-label={t("Copy reply")}
      title={copied ? t("Copied") : t("Copy reply")}
      onClick={() =>
        void navigator.clipboard.writeText(text).then(
          () => setCopied(true),
          () => undefined,
        )
      }
      className={cn(
        "absolute -bottom-6 -left-1.5 grid size-6 place-items-center rounded-md text-fg-subtle transition-[opacity,color] duration-fast hover:bg-hover hover:text-fg focus-visible:opacity-100",
        copied ? "opacity-100" : "opacity-0 group-hover/reply:opacity-100",
      )}
    >
      <Icon size={13} strokeWidth={1.75} aria-hidden />
    </button>
  );
}

export const Item = memo(function Item({
  item,
  streaming,
  terminals,
  shown,
  onEdit,
}: {
  item: ChatItem;
  streaming: boolean;
  terminals: SessionView["terminals"];
  shown?: ReadonlySet<string>;
  /** "Edit and retry" for a user message; absent while it is not offered. */
  onEdit?: (itemId: string) => void;
}) {
  switch (item.kind) {
    case "user":
      return <UserMessage blocks={item.blocks} onEdit={onEdit && (() => onEdit(item.id))} />;
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

function UserMessage({ blocks, onEdit }: { blocks: AcpContentBlock[]; onEdit?: () => void }) {
  const text = blocks
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("\n")
    .trim();
  const files = blocks.flatMap((b) =>
    b.type === "resource_link" ? [b.name || b.uri] : b.type === "resource" ? [b.resource.uri] : [],
  );
  const images = blocks.flatMap((b) => (b.type === "image" ? [b] : []));
  const bubble = text || files.length > 0;
  const edit = onEdit && <EditAndRetry onEdit={onEdit} />;
  return (
    <div className="group/user flex flex-col items-end gap-1.5">
      {images.length > 0 && (
        <div className="relative flex max-w-[85%] flex-wrap justify-end gap-1.5">
          {images.map((img, i) => (
            <img
              key={i}
              src={dataUrl(img.mimeType, img.data)}
              alt={t("Attached image")}
              className="max-h-48 max-w-72 rounded-xl border border-glass-border object-cover"
            />
          ))}
          {!bubble && edit}
        </div>
      )}
      {bubble && (
        <div className="relative max-w-[85%] rounded-2xl rounded-br-md border border-glass-border bg-glass-strong px-4 py-2.5 text-[length:var(--chat-text,13px)] leading-[1.7] whitespace-pre-wrap text-fg backdrop-blur-xl select-text [overflow-wrap:anywhere]">
          {edit}
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

/**
 * "Edit and retry": a new chat continues from before this message, with it in the
 * composer. Left of the bubble, shown on hover or focus like "Copy reply".
 */
function EditAndRetry({ onEdit }: { onEdit: () => void }) {
  return (
    <button
      type="button"
      aria-label={t("Edit and retry")}
      title={t("Edit and retry in a new chat")}
      onClick={onEdit}
      className="absolute right-full bottom-1 mr-1.5 grid size-6 place-items-center rounded-md text-fg-subtle opacity-0 transition-[opacity,color] duration-fast group-hover/user:opacity-100 hover:bg-hover hover:text-fg focus-visible:opacity-100"
    >
      <Pencil size={13} strokeWidth={1.75} aria-hidden />
    </button>
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
