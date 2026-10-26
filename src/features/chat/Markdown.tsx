import { memo, useEffect, useMemo, useRef, type MouseEvent } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { cn } from "@/shared/ui/cn";
import { highlightCodeBlocks } from "./codeHighlight";
import { closeOpenFence, splitBlocks } from "./markdownBlocks";
import { renderMarkdown } from "./renderMarkdown";
import "./chat.css";

const COPIED_MS = 1400;
const SAFE_LINK = /^(https?:|mailto:)/i;

interface MarkdownProps {
  text: string;
  /** The message is still arriving: the tail block re-renders and shows the caret. */
  streaming?: boolean;
}

/**
 * Agent markdown, split into blocks so only the growing tail is re-parsed per chunk;
 * finished blocks are memoised by their source and get Monaco colouring once.
 */
export const Markdown = memo(function Markdown({ text, streaming = false }: MarkdownProps) {
  const blocks = useMemo(() => splitBlocks(text), [text]);
  const last = blocks.length - 1;

  return (
    <div className="md" onClick={onMarkdownClick}>
      {blocks.map((block, index) => {
        const live = streaming && index === last;
        return (
          <MarkdownBlock key={index} source={live ? closeOpenFence(block) : block} live={live} />
        );
      })}
    </div>
  );
});

const MarkdownBlock = memo(function MarkdownBlock({
  source,
  live,
}: {
  source: string;
  live: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => renderMarkdown(source), [source]);

  useEffect(() => {
    // Colour once the block has settled; the streaming tail stays plain until then.
    if (!live && ref.current) void highlightCodeBlocks(ref.current);
  }, [html, live]);

  return (
    <div
      ref={ref}
      className={cn("md-block", live && "md-live")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

/** Delegated clicks: links open in the system browser, code headers copy their block. */
function onMarkdownClick(event: MouseEvent<HTMLDivElement>) {
  const target = event.target as HTMLElement;

  const copy = target.closest<HTMLButtonElement>("[data-copy]");
  if (copy) {
    const code = copy.closest(".md-code")?.querySelector("code")?.textContent ?? "";
    void navigator.clipboard.writeText(code).then(() => {
      copy.textContent = "KopyalandÄ±";
      copy.dataset.done = "";
      window.setTimeout(() => {
        copy.textContent = "Kopyala";
        delete copy.dataset.done;
      }, COPIED_MS);
    });
    return;
  }

  const link = target.closest<HTMLAnchorElement>("a[href]");
  if (link) {
    event.preventDefault();
    const href = link.getAttribute("href") ?? "";
    if (SAFE_LINK.test(href)) void openUrl(href);
  }
}
