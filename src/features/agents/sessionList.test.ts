import { describe, expect, it } from "vitest";
import { FIXTURE_SETUPS } from "./fixtures";
import { createSessionView } from "./reducer";
import { groupByProject, mergeSessionList, sameProject } from "./sessionList";
import type { AgentSessionInfo } from "./types";

const h = (
  sessionId: string,
  cwd: string,
  updatedAt: string | null,
  title: string | null = sessionId,
): AgentSessionInfo => ({
  agentId: "claude",
  sessionId,
  cwd,
  title,
  updatedAt,
});

describe("mergeSessionList", () => {
  it("carries pins and prefers the user's name, also over an open session's title", () => {
    const view = createSessionView(FIXTURE_SETUPS.claude, "C:/p", {
      sessionId: "a",
      agentId: "claude",
      title: "agent title",
    });
    const [entry] = mergeSessionList(
      [{ ...h("a", "C:/p", null, "agent title"), pinned: true, customTitle: "Benim adım" }],
      { a: { ...view, sessionId: "a" } },
      null,
    );
    expect(entry.open).toBe(true);
    expect(entry.pinned).toBe(true);
    expect(entry.renamed).toBe(true);
    expect(entry.title).toBe("Benim adım");
  });

  it("sorts by last update, newest first, with unknown dates last", () => {
    const list = mergeSessionList(
      [
        h("a", "C:\\p", "2026-10-01T00:00:00Z"),
        h("b", "C:\\p", null),
        h("c", "C:\\p", "2026-10-03T00:00:00Z"),
      ],
      {},
      null,
    );
    expect(list.map((e) => e.sessionId)).toEqual(["c", "a", "b"]);
    expect(list[0]).toMatchObject({ open: false, active: false, running: false });
  });

  it("overlays open sessions and adds ones missing from history", () => {
    const open = createSessionView({ ...FIXTURE_SETUPS.claude, sessionId: "a" }, "C:\\p", {
      title: "Yeni başlık",
      updatedAt: "2026-10-05T00:00:00Z",
      turn: "running",
    });
    const fresh = createSessionView({ ...FIXTURE_SETUPS.codex, sessionId: "n" }, "C:\\q", {
      items: [
        { kind: "user", id: "user-1", blocks: [{ type: "text", text: "Testleri\nçalıştır" }] },
      ],
    });
    const list = mergeSessionList(
      [h("a", "C:\\p", "2026-10-01T00:00:00Z", "Eski")],
      { a: open, n: fresh },
      "n",
    );
    const a = list.find((e) => e.sessionId === "a");
    expect(a).toMatchObject({
      title: "Yeni başlık",
      open: true,
      running: true,
      updatedAt: "2026-10-05T00:00:00Z",
    });
    const n = list.find((e) => e.sessionId === "n");
    expect(n).toMatchObject({
      agentId: "codex",
      cwd: "C:\\q",
      title: "Testleri çalıştır",
      active: true,
    });
  });

  it("does not merge equal session ids from different agents", () => {
    const list = mergeSessionList(
      [h("x", "C:\\p", null), { ...h("x", "C:\\p", null), agentId: "gemini" }],
      {},
      null,
    );
    expect(list).toHaveLength(2);
  });
});

describe("groupByProject", () => {
  it("groups by folder, ignoring case and slash style, newest project first", () => {
    const groups = groupByProject(
      mergeSessionList(
        [
          h("a", "C:\\Work\\alpha", "2026-10-01T00:00:00Z"),
          h("b", "c:/work/alpha/", "2026-10-04T00:00:00Z"),
          h("c", "C:\\Work\\beta", "2026-10-02T00:00:00Z"),
        ],
        {},
        null,
      ),
    );
    expect(groups.map((g) => [g.name, g.sessions.map((s) => s.sessionId)])).toEqual([
      ["alpha", ["b", "a"]],
      ["beta", ["c"]],
    ]);
    expect(groups[0].latest).toBe("2026-10-04T00:00:00Z");
  });

  it("compares project paths loosely", () => {
    expect(sameProject("C:\\A\\b", "c:/a/B/")).toBe(true);
    expect(sameProject("C:\\A\\b", "C:\\A\\bc")).toBe(false);
  });
});
