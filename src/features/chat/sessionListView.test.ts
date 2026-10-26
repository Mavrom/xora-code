import { describe, expect, it } from "vitest";
import type { ProjectGroup, SessionListEntry } from "@/features/agents/sessionList";
import type { SessionView } from "@/features/agents/reducer";
import { emptySessionKey, visibleGroups } from "./sessionListView";

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
