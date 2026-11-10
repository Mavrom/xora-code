// Folding long runs of tool calls into one summary row. A view concern only: the items
// (and the Markdown export built from them) are untouched.
import type { ChatItem } from "@/features/agents/reducer";
import type { AcpToolCall, AcpToolKind } from "@/features/agents/types";
import { localeOf, t } from "@/shared/i18n";
import { diffLines, diffStats } from "./diff";
import { toolDiffs, toolImages } from "./toolView";

/** Finished calls a run needs before it folds. */
export const FOLD_THRESHOLD = 4;
/** Rows a fold must actually hide; folding a single row only adds one. */
const MIN_HIDDEN = 2;

export type ToolItem = Extract<ChatItem, { kind: "tool" }>;

/** How the summary counts a call, from its ACP kind. */
export type RunBucket = "read" | "edit" | "search" | "execute" | "fetch" | "other";
const BUCKETS: readonly RunBucket[] = ["read", "edit", "search", "execute", "fetch", "other"];
const BUCKET_OF: Partial<Record<AcpToolKind, RunBucket>> = {
  read: "read",
  edit: "edit",
  search: "search",
  execute: "execute",
  fetch: "fetch",
};

export interface RunSummary {
  /** Finished (completed or failed) calls per bucket. */
  counts: Record<RunBucket, number>;
  failed: number;
  added: number;
  removed: number;
  /** From the first finished call's start to the last one's end; null when none has times. */
  durationMs: number | null;
}

/** A folded run: its calls in order, which of them stay visible, and what it adds up to. */
export interface ToolRun {
  kind: "run";
  /** The first call's id: stable while the run grows. */
  id: string;
  items: readonly ToolItem[];
  /** Per item: shown even while the run is folded. */
  pinned: readonly boolean[];
  summary: RunSummary;
}

export type ListRow = { kind: "item"; item: ChatItem } | ToolRun;

export interface RunContext {
  /** The turn is streaming: the run at the end of the list is still open. */
  live: boolean;
  /** Tool calls with a pending permission prompt. */
  permissions: ReadonlySet<string>;
}

const isRunning = (call: AcpToolCall) =>
  call.status === undefined || call.status === "pending" || call.status === "in_progress";

/**
 * Whether a call stays visible inside a folded run: still running, failed, waiting for
 * permission, carrying pictures, or the newest finished call of a run that is still open
 * (it folds once the next call starts, so rows swap one for one instead of popping).
 */
function isPinned(item: ToolItem, tail: boolean, ctx: RunContext): boolean {
  const { call } = item;
  return (
    tail ||
    isRunning(call) ||
    call.status === "failed" ||
    ctx.permissions.has(item.id) ||
    toolImages(call).length > 0
  );
}

const statsCache = new WeakMap<AcpToolCall, { added: number; removed: number }>();

function callStats(call: AcpToolCall) {
  let stats = statsCache.get(call);
  if (!stats) {
    stats = { added: 0, removed: 0 };
    for (const d of toolDiffs(call)) {
      const s = diffStats(diffLines(d.oldText, d.newText));
      stats.added += s.added;
      stats.removed += s.removed;
    }
    statsCache.set(call, stats);
  }
  return stats;
}

export function summarize(items: readonly ToolItem[]): RunSummary {
  const counts = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<RunBucket, number>;
  let failed = 0;
  let added = 0;
  let removed = 0;
  let start = Infinity;
  let end = -Infinity;
  for (const item of items) {
    const { call } = item;
    if (isRunning(call)) continue;
    counts[BUCKET_OF[call.kind ?? "other"] ?? "other"]++;
    if (call.status === "failed") failed++;
    const stats = callStats(call);
    added += stats.added;
    removed += stats.removed;
    if (item.endedAt !== null) {
      start = Math.min(start, item.startedAt);
      end = Math.max(end, item.endedAt);
    }
  }
  return { counts, failed, added, removed, durationMs: end >= start ? end - start : null };
}

const sameList = <T>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** One run of consecutive tool items: a fold, or its items as plain rows. */
function foldRun(
  items: ToolItem[],
  open: boolean,
  ctx: RunContext,
  prev: ReadonlyMap<string, ToolRun>,
): ListRow[] {
  const pinned = items.map((item, i) => isPinned(item, open && i === items.length - 1, ctx));
  const finished = items.filter((i) => !isRunning(i.call)).length;
  const hidden = pinned.filter((p) => !p).length;
  if (finished < FOLD_THRESHOLD || hidden < MIN_HIDDEN) {
    return items.map((item) => ({ kind: "item", item }));
  }
  const id = items[0].id;
  const before = prev.get(id);
  if (before && sameList(before.items, items) && sameList(before.pinned, pinned)) return [before];
  return [{ kind: "run", id, items, pinned, summary: summarize(items) }];
}

/**
 * The transcript's rows: every item as is, except runs of consecutive tool calls (nothing
 * else in between) that fold into one {@link ToolRun}. Any other item, a finished thought
 * included, ends a run. Runs whose calls did not change are returned as the same objects
 * as in `prev`, so memoised rows skip re-rendering while a turn streams.
 */
export function groupToolRuns(
  items: readonly ChatItem[],
  ctx: RunContext,
  prev: ReadonlyMap<string, ToolRun> = new Map(),
): ListRow[] {
  const rows: ListRow[] = [];
  let run: ToolItem[] = [];
  const flush = (open: boolean) => {
    if (run.length > 0) rows.push(...foldRun(run, open, ctx, prev));
    run = [];
  };
  for (const item of items) {
    if (item.kind === "tool") {
      run.push(item);
      continue;
    }
    flush(false);
    rows.push({ kind: "item", item });
  }
  flush(ctx.live);
  return rows;
}

/** {@link groupToolRuns} that remembers its last runs, for stable identities across calls. */
export function createRunGrouper() {
  let prev = new Map<string, ToolRun>();
  return (items: readonly ChatItem[], ctx: RunContext): ListRow[] => {
    const rows = groupToolRuns(items, ctx, prev);
    prev = new Map(rows.flatMap((r) => (r.kind === "run" ? [[r.id, r] as const] : [])));
    return rows;
  };
}

const count = (n: number) => n.toLocaleString(localeOf());

function phrase(bucket: RunBucket, n: number): string {
  const one = n === 1;
  switch (bucket) {
    case "read":
      return one ? t("read 1 file") : t("read {n} files", { n: count(n) });
    case "edit":
      return one ? t("edited 1 file") : t("edited {n} files", { n: count(n) });
    case "search":
      return one ? t("ran 1 search") : t("ran {n} searches", { n: count(n) });
    case "execute":
      return one ? t("ran 1 command") : t("ran {n} commands", { n: count(n) });
    case "fetch":
      return one ? t("fetched 1 page") : t("fetched {n} pages", { n: count(n) });
    case "other":
      return one ? t("used 1 other tool") : t("used {n} other tools", { n: count(n) });
  }
}

/** "Read 5 files, edited 2 files, ran 1 command" (kinds in a fixed order). */
export function summaryText(summary: RunSummary): string {
  const text = BUCKETS.filter((b) => summary.counts[b] > 0)
    .map((b) => phrase(b, summary.counts[b]))
    .join(", ");
  return text.charAt(0).toLocaleUpperCase(localeOf()) + text.slice(1);
}

/** "2 failed", or null when nothing did. */
export function failedText(summary: RunSummary): string | null {
  if (summary.failed === 0) return null;
  return summary.failed === 1 ? t("1 failed") : t("{n} failed", { n: count(summary.failed) });
}
