import { useEffect, useId, useLayoutEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { TextSearch } from "lucide-react";
import { revealInEditor } from "@/features/chat/editorBridge";
import { setPaletteOpen } from "@/features/commands/paletteGuard";
import { moveIndex } from "@/features/commands/results";
import { absolutePath } from "@/features/files/fileIndex";
import { useWorkspaceStore } from "@/features/workspace/store";
import { FOCUSABLE, nextTrapIndex } from "@/shared/ui/focusTrap";
import { Kbd } from "@/shared/ui/Kbd";
import { t } from "@/shared/i18n";
import {
  canSearch,
  describeSearchError,
  matchRange,
  MIN_QUERY,
  resultRows,
  summaryText,
} from "./searchModel";
import { useSearchStore } from "./searchStore";
import { SearchResults } from "./SearchResults";
import { SearchToggles } from "./SearchToggles";
import { toggleFor } from "./shortcut";

/** Ctrl+Shift+F: search the contents of the open folder's files. Mount only while open. */
export function FindInFiles({ onClose }: { onClose: () => void }) {
  const root = useWorkspaceStore((s) => s.root);
  const query = useSearchStore((s) => s.query);
  const caseSensitive = useSearchStore((s) => s.caseSensitive);
  const wholeWord = useSearchStore((s) => s.wholeWord);
  const regex = useSearchStore((s) => s.regex);
  const status = useSearchStore((s) => s.status);
  const results = useSearchStore((s) => s.results);
  const resultsQuery = useSearchStore((s) => s.resultsQuery);
  const error = useSearchStore((s) => s.error);
  const active = useSearchStore((s) => s.active);
  const { setQuery, toggle, setActive } = useSearchStore.getState();
  const dialog = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const list = useMemo(() => resultRows(results), [results]);
  const failure = status === "error" ? describeSearchError(error) : null;
  const searching = status === "searching";

  // The first run after opening refreshes the shown results; later ones follow the typing.
  // (Reset on every mount, StrictMode's second one included.)
  const opened = useRef(false);
  useLayoutEffect(() => {
    opened.current = false;
  }, []);
  useEffect(() => {
    useSearchStore.getState().request(root, !opened.current);
    opened.current = true;
  }, [root, query, caseSensitive, wholeWord, regex]);

  // Focus the input with its text selected (the last or seeded query); give focus back on
  // close and stop a search nobody will see.
  useLayoutEffect(() => {
    setPaletteOpen(true);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    input.current?.focus();
    input.current?.select();
    return () => {
      setPaletteOpen(false);
      useSearchStore.getState().stop();
      previous?.focus({ preventScroll: true });
    };
  }, []);

  const open = (matchIndex: number) => {
    const { results: shown, resultsRoot } = useSearchStore.getState();
    const row = list.rows[list.matchRows[matchIndex] ?? -1];
    if (!shown || !resultsRoot || row?.kind !== "match") return;
    flushSync(onClose);
    revealInEditor(absolutePath(resultsRoot, row.file.path), matchRange(row.match));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const option = toggleFor(e);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (option) {
      e.preventDefault();
      toggle(option);
    } else if (e.key === "Tab") {
      // Cycle between the input and the option buttons; the list is reached by arrows.
      e.preventDefault();
      const items = [...(dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
      const current = items.indexOf(document.activeElement as HTMLElement);
      items[nextTrapIndex(current, items.length, e.shiftKey)]?.focus();
    } else if (e.target !== input.current) {
      // Buttons keep their own Enter and Space.
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive(moveIndex(active, e.key === "ArrowDown" ? 1 : -1, list.matchRows.length));
    } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      open(active);
    }
  };

  const hasRows = list.matchRows.length > 0;
  const empty = !root
    ? t("Open a folder first.")
    : !canSearch(query)
      ? t("Type at least {n} characters to search the folder.", { n: MIN_QUERY })
      : failure
        ? failure.badRegex
          ? null
          : failure.message
        : hasRows
          ? null
          : // Kept while a refresh runs, so reopening never flashes "Searching…".
            results
            ? t("No results for “{query}”.", { query: resultsQuery })
            : t("Searching…");

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/60 px-4 pt-[10vh] transition-opacity duration-150 ease-out-quint starting:opacity-0"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={t("Find in files")}
        onKeyDown={onKeyDown}
        // Clicks outside the input must not pull focus out of it (Esc and the arrows).
        onMouseDown={(e) => {
          if (e.target !== input.current) e.preventDefault();
        }}
        className="flex h-[min(640px,78vh)] w-full max-w-[760px] flex-col overflow-hidden rounded-lg border border-border-strong bg-surface shadow-2xl shadow-black/70 transition-[opacity,scale,translate] duration-150 ease-out-quint starting:translate-y-1 starting:scale-[.98] starting:opacity-0"
      >
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border pr-3 pl-4">
          {searching ? (
            <span
              aria-hidden
              className="mx-0.5 size-3 shrink-0 animate-spin rounded-full border-[1.5px] border-border-strong border-t-fg motion-reduce:animate-none"
            />
          ) : (
            <TextSearch
              size={16}
              strokeWidth={1.75}
              className="shrink-0 text-fg-subtle"
              aria-hidden
            />
          )}
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls={`${baseId}-list`}
            aria-activedescendant={hasRows ? optionId(active) : undefined}
            aria-autocomplete="list"
            aria-invalid={failure?.badRegex || undefined}
            aria-describedby={`${baseId}-status`}
            spellCheck={false}
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search in files…")}
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-subtle focus-visible:outline-none"
          />
          <SearchToggles />
          <Kbd keys="esc" />
        </div>

        {failure?.badRegex && (
          <div
            role="alert"
            className="shrink-0 border-b border-border px-4 py-2 text-xs text-danger"
          >
            <p>{t("Invalid regular expression")}</p>
            <pre className="mt-1 overflow-x-auto font-mono text-2xs whitespace-pre text-fg-muted">
              {failure.message}
            </pre>
          </div>
        )}

        <div
          id={`${baseId}-status`}
          aria-live="polite"
          className="flex h-8 shrink-0 items-center gap-2 px-4 text-2xs text-fg-subtle"
        >
          {results && hasRows && (
            <>
              <span className="shrink-0 text-fg-muted">{summaryText(results)}</span>
              {results.truncated && (
                <span className="truncate">
                  {t("Some results are not shown; narrow the search.")}
                </span>
              )}
            </>
          )}
        </div>

        {empty ? (
          <div
            id={`${baseId}-list`}
            role="listbox"
            aria-label={t("Search results")}
            className="min-h-0 flex-1"
          >
            <p className="px-4 py-8 text-center text-[13px] text-fg-muted">{empty}</p>
          </div>
        ) : (
          <SearchResults
            id={`${baseId}-list`}
            list={list}
            active={active}
            optionId={optionId}
            busy={searching}
            onHover={setActive}
            onOpen={open}
          />
        )}

        <div className="flex h-9 shrink-0 items-center gap-4 border-t border-border px-4 text-[11px] text-fg-subtle">
          <span className="flex items-center gap-1.5">
            <Kbd keys="up" />
            <Kbd keys="down" />
            {t("move")}
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd keys="enter" />
            {t("open")}
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd keys="esc" />
            {t("close")}
          </span>
        </div>
      </div>
    </div>
  );
}
