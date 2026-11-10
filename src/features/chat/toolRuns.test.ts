import { afterEach, describe, expect, it } from "vitest";
import type { ChatItem } from "@/features/agents/reducer";
import type { AcpToolCall, AcpToolKind, AcpToolStatus } from "@/features/agents/types";
import { setLanguage } from "@/shared/i18n";
import { fixtureSessionView } from "@/features/agents/fixtures";
import {
  FOLD_THRESHOLD,
  createRunGrouper,
  failedText,
  groupToolRuns,
  summarize,
  summaryText,
  type ListRow,
  type RunContext,
  type ToolItem,
  type ToolRun,
} from "./toolRuns";

const IDLE: RunContext = { live: false, permissions: new Set() };
const LIVE: RunContext = { live: true, permissions: new Set() };

function tool(
  id: string,
  kind: AcpToolKind = "read",
  status: AcpToolStatus = "completed",
  extra: Partial<AcpToolCall> = {},
  times: [number, number | null] = [0, status === "completed" || status === "failed" ? 1000 : null],
): ToolItem {
  return {
    kind: "tool",
    id,
    call: { toolCallId: id, title: `${kind} ${id}`, kind, status, ...extra },
    startedAt: times[0],
    endedAt: times[1],
  };
}

const user = (id: string): ChatItem => ({ kind: "user", id, blocks: [] });
const agent = (id: string, text = "ok"): ChatItem => ({ kind: "agent", id, text });
const thought = (id: string): ChatItem => ({
  kind: "thought",
  id,
  text: "hmm",
  startedAt: 0,
  endedAt: 1,
});

const reads = (n: number, from = 0) => Array.from({ length: n }, (_, i) => tool(`r${from + i}`));

/** Row shape for assertions: item ids, or `run(id: visible ids | hidden count)`. */
function shape(rows: ListRow[]): string[] {
  return rows.map((r) => {
    if (r.kind === "item") return r.item.id;
    const shown = r.items.filter((_, i) => r.pinned[i]).map((i) => i.id);
    return `run(${r.id}: ${shown.join(",")} | ${r.items.length - shown.length} hidden)`;
  });
}

/** Ids the reader can see without expanding anything, in order. */
function visible(rows: ListRow[]): string[] {
  return rows.flatMap((r) =>
    r.kind === "item" ? [r.item.id] : r.items.filter((_, i) => r.pinned[i]).map((i) => i.id),
  );
}

/** Every item id behind the rows, folded or not, in order. */
function allIds(rows: ListRow[]): string[] {
  return rows.flatMap((r) => (r.kind === "item" ? [r.item.id] : r.items.map((i) => i.id)));
}

describe("groupToolRuns thresholds", () => {
  it("leaves runs shorter than the threshold alone", () => {
    const items = [user("u"), ...reads(FOLD_THRESHOLD - 1), agent("a")];
    expect(shape(groupToolRuns(items, IDLE))).toEqual(["u", "r0", "r1", "r2", "a"]);
  });

  it("folds a run that reaches the threshold", () => {
    const items = [user("u"), ...reads(FOLD_THRESHOLD), agent("a")];
    expect(shape(groupToolRuns(items, IDLE))).toEqual(["u", "run(r0:  | 4 hidden)", "a"]);
  });

  it("counts finished calls only", () => {
    const items = [...reads(3), tool("x", "execute", "in_progress")];
    expect(shape(groupToolRuns(items, LIVE))).toEqual(["r0", "r1", "r2", "x"]);
  });

  it("does not fold when fewer than two rows would hide", () => {
    const items = [
      tool("f1", "read", "failed"),
      tool("f2", "read", "failed"),
      tool("f3", "read", "failed"),
      tool("ok"),
    ];
    expect(shape(groupToolRuns(items, IDLE))).toEqual(["f1", "f2", "f3", "ok"]);
  });
});

describe("groupToolRuns boundaries", () => {
  it("ends a run at agent text, thoughts, plans, notices and user messages", () => {
    const breakers: ChatItem[] = [
      agent("a"),
      thought("t"),
      { kind: "plan", id: "p", entries: [] },
      { kind: "notice", id: "n", severity: "info", title: "x" },
      user("u"),
    ];
    for (const b of breakers) {
      const items = [...reads(2), b, ...reads(2, 2)];
      expect(shape(groupToolRuns(items, IDLE))).toEqual(["r0", "r1", b.id, "r2", "r3"]);
    }
  });

  it("folds each run on its own, keyed by its first call", () => {
    const items = [...reads(4), agent("a"), ...reads(5, 4)];
    expect(shape(groupToolRuns(items, IDLE))).toEqual([
      "run(r0:  | 4 hidden)",
      "a",
      "run(r4:  | 5 hidden)",
    ]);
  });
});

describe("groupToolRuns keeps rows visible", () => {
  it("running and pending calls", () => {
    const items = [
      ...reads(4),
      tool("x", "execute", "in_progress"),
      tool("y", "edit", "pending"),
      agent("a", ""),
    ];
    expect(shape(groupToolRuns(items, LIVE))).toEqual(["run(r0: x,y | 4 hidden)", "a"]);
  });

  it("failed calls, in place", () => {
    const items = [...reads(2), tool("f", "execute", "failed"), ...reads(2, 2)];
    expect(shape(groupToolRuns(items, IDLE))).toEqual(["run(r0: f | 4 hidden)"]);
  });

  it("calls waiting for permission", () => {
    const items = [...reads(4), tool("e", "edit", "completed")];
    const ctx = { live: false, permissions: new Set(["e"]) };
    expect(shape(groupToolRuns(items, ctx))).toEqual(["run(r0: e | 4 hidden)"]);
  });

  it("calls with pictures", () => {
    const pic = tool("img", "other", "completed", {
      content: [
        { type: "content", content: { type: "image", data: "AA==", mimeType: "image/png" } },
      ],
    });
    const items = [...reads(2), pic, ...reads(2, 2)];
    expect(shape(groupToolRuns(items, IDLE))).toEqual(["run(r0: img | 4 hidden)"]);
  });

  it("the newest finished call of the open run, until the run closes", () => {
    const items = reads(5);
    expect(shape(groupToolRuns(items, LIVE))).toEqual(["run(r0: r4 | 4 hidden)"]);
    expect(shape(groupToolRuns(items, IDLE))).toEqual(["run(r0:  | 5 hidden)"]);
    expect(shape(groupToolRuns([...items, agent("a", "")], LIVE))).toEqual([
      "run(r0:  | 5 hidden)",
      "a",
    ]);
  });
});

describe("groupToolRuns while a turn streams", () => {
  /** A turn arriving one update at a time, as the reducer would build it. */
  function stream(): ChatItem[][] {
    const steps: ChatItem[][] = [];
    let items: ChatItem[] = [user("u")];
    const push = (next: ChatItem[]) => {
      items = next;
      steps.push(items);
    };
    for (let i = 0; i < 6; i++) {
      push([...items, tool(`c${i}`, i % 2 ? "edit" : "read", "in_progress")]);
      push(items.map((it) => (it.id === `c${i}` ? tool(`c${i}`, i % 2 ? "edit" : "read") : it)));
    }
    push([...items, agent("a", "Do")]);
    push([...items.slice(0, -1), agent("a", "Done.")]);
    return steps;
  }

  it("never reorders or drops a row", () => {
    const group = createRunGrouper();
    let before: string[] = [];
    for (const items of stream()) {
      const rows = group(items, LIVE);
      expect(allIds(rows)).toEqual(items.map((i) => i.id));
      const now = visible(rows);
      // Visible ids keep their relative order between updates.
      const kept = now.filter((id) => before.includes(id));
      expect(kept).toEqual(before.filter((id) => now.includes(id)));
      // Only the fold itself hides several rows at once; after it, one at a time.
      expect(before.filter((id) => !now.includes(id)).length).toBeLessThan(FOLD_THRESHOLD);
      before = now;
    }
  });

  it("folds once, then keeps a steady two rows: the summary's tail and the live call", () => {
    const group = createRunGrouper();
    const views = stream().map((items) => shape(group(items, LIVE)));
    expect(views[6]).toEqual(["u", "c0", "c1", "c2", "c3"]); // c3 running, 3 finished
    expect(views[7]).toEqual(["u", "run(c0: c3 | 3 hidden)"]); // c3 finished: fold
    expect(views[8]).toEqual(["u", "run(c0: c4 | 4 hidden)"]); // c4 starts, c3 folds
    expect(views[views.length - 1]).toEqual(["u", "run(c0:  | 6 hidden)", "a"]);
  });

  it("returns the same run object while its calls do not change", () => {
    const group = createRunGrouper();
    const items = [user("u"), ...reads(5), agent("a", "x")];
    const first = group(items, LIVE)[1] as ToolRun;
    const next = group([...items.slice(0, -1), agent("a", "xy")], LIVE)[1];
    expect(next).toBe(first);
    const changed = group(
      items.map((i) => (i.id === "r2" ? tool("r2") : i)),
      LIVE,
    )[1];
    expect(changed).not.toBe(first);
  });
});

describe("run summary", () => {
  const diff = (oldText: string, newText: string): Partial<AcpToolCall> => ({
    content: [{ type: "diff", path: "a.ts", oldText, newText }],
  });
  const items = [
    tool("r1", "read", "completed", {}, [100, 300]),
    tool("r2", "read", "completed", {}, [300, 400]),
    tool("e1", "edit", "completed", diff("a\nb\n", "a\nc\nd\n"), [400, 900]),
    tool("x1", "execute", "failed", {}, [900, 2100]),
    tool("s1", "search"),
    tool("d1", "delete"),
    tool("live", "fetch", "in_progress", {}, [2100, null]),
  ];

  it("counts finished calls by kind, failures and diff lines", () => {
    const s = summarize(items);
    expect(s.counts).toEqual({ read: 2, edit: 1, search: 1, execute: 1, fetch: 0, other: 1 });
    expect(s.failed).toBe(1);
    expect([s.added, s.removed]).toEqual([2, 1]);
  });

  it("spans the finished calls' time", () => {
    expect(summarize(items.slice(0, 4)).durationMs).toBe(2000);
    expect(summarize([tool("p", "read", "pending")]).durationMs).toBeNull();
  });

  describe("text", () => {
    afterEach(() => setLanguage("tr"));

    it("reads naturally in Turkish", () => {
      const s = summarize(items);
      expect(summaryText(s)).toBe(
        "2 dosya okundu, 1 dosya düzenlendi, 1 arama yapıldı, 1 komut çalıştırıldı, 1 başka araç kullanıldı",
      );
      expect(failedText(s)).toBe("1 başarısız");
    });

    it("uses singular and plural forms in English", () => {
      setLanguage("en");
      expect(summaryText(summarize(items))).toBe(
        "Read 2 files, edited 1 file, ran 1 search, ran 1 command, used 1 other tool",
      );
      const many = summarize([
        ...reads(5),
        tool("x1", "execute"),
        tool("x2", "execute", "failed"),
        tool("f1", "fetch"),
        tool("s1", "search"),
        tool("s2", "search"),
      ]);
      expect(summaryText(many)).toBe(
        "Read 5 files, ran 2 searches, ran 2 commands, fetched 1 page",
      );
      expect(failedText(many)).toBe("1 failed");
      expect(failedText({ ...many, failed: 3 })).toBe("3 failed");
      expect(failedText({ ...many, failed: 0 })).toBeNull();
    });
  });
});

describe("toolRun fixture", () => {
  it("folds its run, keeping the failed call visible", () => {
    const view = fixtureSessionView("toolRun");
    const rows = groupToolRuns(view.items, { live: false, permissions: new Set() });
    expect(shape(rows)).toEqual([
      "user-0",
      "agent-1",
      "run(tc-run-1: tc-run-5 | 6 hidden)",
      "agent-2",
    ]);
    const run = rows[2] as ToolRun;
    expect(failedText(run.summary)).toBe("1 başarısız");
    expect(summaryText(run.summary)).toBe(
      "3 dosya okundu, 1 dosya düzenlendi, 1 arama yapıldı, 2 komut çalıştırıldı",
    );
  });
});
