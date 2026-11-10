import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FileIcon } from "@/features/files/FileIcon";
import { scrollToReveal, visibleRange } from "@/features/files/virtualRange";
import { cn } from "@/shared/ui/cn";
import { t } from "@/shared/i18n";
import { highlightParts, type ResultList, type ResultRow } from "./searchModel";

/** Every row (file header or line) is exactly this tall, which makes windowing cheap. */
const ROW_HEIGHT = 28;
/** Rows rendered above and below the viewport so fast scrolling never shows a gap. */
const OVERSCAN = 12;
/** Space above the first and below the last row (QuickOpen's `py-1.5`). */
const PADDING = 6;

interface SearchResultsProps {
  id: string;
  list: ResultList;
  /** Index of the selected match. */
  active: number;
  optionId: (matchIndex: number) => string;
  busy: boolean;
  onHover: (matchIndex: number) => void;
  onOpen: (matchIndex: number) => void;
}

/** The results, windowed: only the rows near the viewport are in the DOM (2000 rows stay smooth). */
export function SearchResults({
  id,
  list,
  active,
  optionId,
  busy,
  onHover,
  onOpen,
}: SearchResultsProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: 0, height: 0 });
  const { rows, matchRows } = list;

  // Track the scroll position and height; scroll events are coalesced per frame.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      setViewport((prev) =>
        prev.top === el.scrollTop && prev.height === el.clientHeight
          ? prev
          : { top: el.scrollTop, height: el.clientHeight },
      );
    };
    read();
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    const observer = new ResizeObserver(read);
    observer.observe(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  // New results start at the top.
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [rows]);

  // Keep the selected line in view, with its file header when it is the file's first line.
  useEffect(() => {
    const el = scroller.current;
    const index = matchRows[active];
    if (!el || index === undefined) return;
    const header = rows[index - 1]?.kind === "file" ? index - 1 : index;
    for (const row of [header, index]) {
      const next = scrollToReveal(row, el.scrollTop, el.clientHeight, ROW_HEIGHT, PADDING);
      if (next !== null) el.scrollTop = next;
    }
  }, [active, rows, matchRows]);

  const range = visibleRange(
    viewport.top - PADDING,
    viewport.height,
    ROW_HEIGHT,
    rows.length,
    OVERSCAN,
  );
  const rendered: number[] = [];
  for (let i = range.start; i < range.end; i++) rendered.push(i);
  // The selected option must exist for aria-activedescendant, wherever it is scrolled.
  const activeRow = matchRows[active];
  if (activeRow !== undefined && (activeRow < range.start || activeRow >= range.end)) {
    rendered.push(activeRow);
  }

  return (
    <div
      ref={scroller}
      id={id}
      role="listbox"
      aria-label={t("Search results")}
      aria-busy={busy}
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <div className="relative" style={{ height: rows.length * ROW_HEIGHT + PADDING * 2 }}>
        {rendered.map((i) => {
          const row = rows[i];
          const top = PADDING + i * ROW_HEIGHT;
          return row.kind === "file" ? (
            <FileHeader key={row.key} row={row} top={top} />
          ) : (
            <MatchLine
              key={row.key}
              id={optionId(row.matchIndex)}
              row={row}
              top={top}
              setSize={matchRows.length}
              active={row.matchIndex === active}
              onHover={() => onHover(row.matchIndex)}
              onOpen={() => onOpen(row.matchIndex)}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Name bright, folder dim, match count at the end. Screen readers get the file in each option. */
function FileHeader({ row, top }: { row: Extract<ResultRow, { kind: "file" }>; top: number }) {
  return (
    <div
      aria-hidden
      style={{ top, height: ROW_HEIGHT }}
      className="absolute inset-x-1.5 flex items-center gap-2.5 px-2.5 text-[13px]"
    >
      <FileIcon name={row.name} />
      <span className="shrink-0 text-fg">{row.name}</span>
      {row.dir && <span className="min-w-0 truncate text-[12px] text-fg-subtle">{row.dir}</span>}
      <span className="ml-auto shrink-0 pl-2 text-2xs text-fg-subtle tabular-nums">
        {row.file.count}
      </span>
    </div>
  );
}

interface MatchLineProps {
  id: string;
  row: Extract<ResultRow, { kind: "match" }>;
  top: number;
  setSize: number;
  active: boolean;
  onHover: () => void;
  onOpen: () => void;
}

function MatchLine({ id, row, top, setSize, active, onHover, onOpen }: MatchLineProps) {
  const { match, file } = row;
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      aria-setsize={setSize}
      aria-posinset={row.matchIndex + 1}
      aria-label={t("{path}, line {line}: {text}", {
        path: file.path,
        line: match.line,
        text: match.text,
      })}
      data-active={active || undefined}
      // Pointer moves (not mouseenter) so a list scrolled by the keyboard keeps its cursor.
      onPointerMove={active ? undefined : onHover}
      // Keep focus in the input.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onOpen}
      style={{ top, height: ROW_HEIGHT }}
      className={cn(
        "absolute inset-x-1.5 flex items-center gap-2.5 rounded-sm pr-2.5 pl-8 transition-colors duration-100",
        active ? "bg-hover text-fg" : "text-fg-muted",
      )}
    >
      <span className="w-8 shrink-0 text-right text-2xs text-fg-subtle tabular-nums">
        {match.line}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-[12px] whitespace-pre">
        {highlightParts(match.text, match.ranges).map((part, i) =>
          part.hit ? (
            <mark key={i} className="rounded-xs bg-border-strong text-fg">
              {part.text}
            </mark>
          ) : (
            part.text
          ),
        )}
      </span>
    </div>
  );
}
