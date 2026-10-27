import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { flushSync } from "react-dom";
import { FileSearch } from "lucide-react";
import { revealInEditor } from "@/features/chat/editorBridge";
import { setPaletteOpen } from "@/features/commands/paletteGuard";
import { moveIndex } from "@/features/commands/results";
import { useWorkspaceStore } from "@/features/workspace/store";
import { cn } from "@/shared/ui/cn";
import { Kbd } from "@/shared/ui/Kbd";
import { FileIcon } from "./FileIcon";
import { absolutePath, loadFileIndex } from "./fileIndex";
import { searchFiles, type FileHit, type IndexedFile } from "./fileSearch";
import { t } from "@/shared/i18n";

/** Ctrl+P: open any file of the folder by typing part of its name. Mount only while open. */
export function QuickOpen({ onClose }: { onClose: () => void }) {
  const root = useWorkspaceStore((s) => s.root);
  const [files, setFiles] = useState<IndexedFile[] | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const baseId = useId();

  useEffect(() => {
    if (!root) return;
    let alive = true;
    void loadFileIndex(root, (fresh) => alive && setFiles(fresh)).then(
      (list) => alive && setFiles(list),
    );
    return () => {
      alive = false;
    };
  }, [root]);

  const hits = useMemo(() => (files ? searchFiles(query, files) : []), [files, query]);

  useLayoutEffect(() => {
    setPaletteOpen(true);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    input.current?.focus();
    return () => {
      setPaletteOpen(false);
      previous?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>("[data-active]")?.scrollIntoView({ block: "nearest" });
  }, [active, hits]);

  const open = (hit: FileHit | undefined) => {
    if (!hit || !root) return;
    flushSync(onClose);
    revealInEditor(absolutePath(root, hit.path));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => moveIndex(i, e.key === "ArrowDown" ? 1 : -1, hits.length));
    } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      open(hits[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === "Tab") {
      e.preventDefault();
    }
  };

  const empty = !root
    ? t("Open a folder first.")
    : files === null
      ? t("Listing files…")
      : hits.length === 0
        ? t("No file matches “{query}”.", { query: query.trim() })
        : null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/60 px-4 pt-[16vh] transition-opacity duration-150 ease-out-quint starting:opacity-0"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Open file")}
        onKeyDown={onKeyDown}
        onMouseDown={(e) => {
          if (e.target !== input.current) e.preventDefault();
        }}
        className="flex h-fit max-h-[min(480px,70vh)] w-full max-w-[600px] flex-col overflow-hidden rounded-lg border border-border-strong bg-surface shadow-2xl shadow-black/70 transition-[opacity,scale,translate] duration-150 ease-out-quint starting:translate-y-1 starting:scale-[.98] starting:opacity-0"
      >
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
          <FileSearch
            size={16}
            strokeWidth={1.75}
            className="shrink-0 text-fg-subtle"
            aria-hidden
          />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls={`${baseId}-list`}
            aria-activedescendant={hits.length > 0 ? `${baseId}-${active}` : undefined}
            aria-autocomplete="list"
            spellCheck={false}
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder={t("Type a file name…")}
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-subtle"
          />
          <Kbd keys="esc" />
        </div>
        <div
          ref={list}
          id={`${baseId}-list`}
          role="listbox"
          aria-label={t("Files")}
          className="min-h-0 flex-1 scroll-py-1.5 overflow-y-auto py-1.5"
        >
          {empty ? (
            <p className="px-4 py-8 text-center text-[13px] text-fg-muted">{empty}</p>
          ) : (
            hits.map((hit, i) => (
              <FileRow
                key={hit.path}
                id={`${baseId}-${i}`}
                hit={hit}
                active={i === active}
                onHover={() => setActive(i)}
                onOpen={() => open(hit)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Name bright, folder dim; matched letters stand out. Shared with the `@` popover. */
export function FileRow({
  id,
  hit,
  active,
  onHover,
  onOpen,
}: {
  id: string;
  hit: FileHit;
  active: boolean;
  onHover: () => void;
  onOpen: () => void;
}) {
  const cut = hit.path.lastIndexOf("/") + 1;
  const name = hit.path.slice(cut);
  const dir = hit.path.slice(0, Math.max(0, cut - 1));
  const hitSet = new Set(hit.positions);
  const mark = (text: string, offset: number) =>
    [...text].map((ch, i) =>
      hitSet.has(i + offset) ? (
        <span key={i} className="font-semibold text-fg">
          {ch}
        </span>
      ) : (
        ch
      ),
    );
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      data-active={active || undefined}
      onPointerMove={active ? undefined : onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onOpen}
      className={cn(
        "mx-1.5 flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-[13px] transition-colors duration-100",
        active ? "bg-hover text-fg" : "text-fg-muted",
      )}
    >
      <FileIcon name={name} />
      <span className="shrink-0 text-fg">{mark(name, cut)}</span>
      {dir && <span className="min-w-0 truncate text-[12px] text-fg-subtle">{mark(dir, 0)}</span>}
    </div>
  );
}
