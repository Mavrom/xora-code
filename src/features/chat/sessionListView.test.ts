import { describe, expect, it } from "vitest";
import type { ProjectGroup, SessionListEntry } from "@/features/agents/sessionList";
import type { SessionView } from "@/features/agents/reducer";
import { emptySessionKey, flatSessions, groupByDay, visibleGroups } from "./sessionListView";

const entry = (sessionId: string, extra: Partial<SessionListEntry> = {}): SessionListEntry => ({
  agentId: "claude",
  sessionId,
  cwd: "C:/a",
  title: sessionId,
  updatedAt: null,
  open: false,
  active: false,
  running: false,
  ...extra,
});

const group = (cwd: string, sessions: SessionListEntry[]): ProjectGroup => ({
  cwd,
  name: cwd,
  sessions,
  latest: null,
});

describe("emptySessionKey", () => {
  it("lists sessions without items, ignoring ones still loading", () => {
    const view = (sessionId: string, items: number, loading = false) =>
      ({ sessionId, items: new Array(items).fill({}), loading }) as unknown as SessionView;
    expect(
      emptySessionKey({ b: view("b", 0), a: view("a", 0), c: view("c", 2), d: view("d", 0, true) }),
    ).toBe("a\nb");
    expect(emptySessionKey({})).toBe("");
  });
});

describe("visibleGroups", () => {
  it("hides empty open sessions and drops groups left empty", () => {
    const groups = [
      group("C:/a", [entry("warm", { open: true, active: true }), entry("old")]),
      group("C:/b", [entry("idle", { open: true })]),
    ];
    const out = visibleGroups(groups, "idle\nwarm", null);
    expect(out.map((g) => g.cwd)).toEqual(["C:/a"]);
    expect(out[0].sessions.map((s) => s.sessionId)).toEqual(["old"]);
  });

  it("moves the open workspace to the top", () => {
    const groups = [group("C:/b", [entry("x")]), group("C:/A/", [entry("y")])];
    expect(visibleGroups(groups, "", "c:\\a").map((g) => g.cwd)).toEqual(["C:/A/", "C:/b"]);
  });
});

describe("flatSessions", () => {
  it("merges projects newest first, open untimed sessions on top, or keeps one project", () => {
    const groups = [
      group("C:/a", [entry("old", { updatedAt: "2026-01-01T00:00:00Z" })]),
      group("C:/b", [
        entry("new", { cwd: "C:/b", updatedAt: "2026-02-01T00:00:00Z" }),
        entry("live", { cwd: "C:/b", open: true }),
      ]),
    ];
    expect(flatSessions(groups, null).map((e) => e.sessionId)).toEqual(["live", "new", "old"]);
    expect(flatSessions(groups, "c:\\A").map((e) => e.sessionId)).toEqual(["old"]);
  });
});

describe("groupByDay", () => {
  it("labels today, yesterday, this week and older, in list order", () => {
    const now = new Date(2026, 9, 26, 15, 0).getTime();
    const at = (d: number, h = 12) => new Date(2026, 9, d, h).toISOString();
    const groups = groupByDay(
      [
        entry("live", { open: true }),
        entry("t", { updatedAt: at(26, 9) }),
        entry("y", { updatedAt: at(25) }),
        entry("w", { updatedAt: at(21) }),
        entry("o", { updatedAt: at(10) }),
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.entries.map((e) => e.sessionId)])).toEqual([
      ["Bugün", ["live", "t"]],
      ["Dün", ["y"]],
      ["Bu hafta", ["w"]],
      ["Daha eski", ["o"]],
    ]);
  });
});
