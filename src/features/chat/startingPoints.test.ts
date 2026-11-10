import { describe, expect, it } from "vitest";
import type { SessionListEntry } from "@/features/agents/sessionList";
import type { Note } from "@/shared/lib/ipc";
import {
  MAX_STARTING_POINTS,
  noteLine,
  startingPoints,
  STARTER_PROMPTS,
  type StartingPointsInput,
} from "./startingPoints";

const entry = (sessionId: string, extra: Partial<SessionListEntry> = {}): SessionListEntry => ({
  agentId: "claude",
  sessionId,
  cwd: "C:\\work\\app",
  title: sessionId,
  updatedAt: null,
  open: false,
  active: false,
  running: false,
  archived: false,
  pinned: false,
  renamed: false,
  ...extra,
});

const note = (id: string, extra: Partial<Note> = {}): Note => ({
  id,
  text: id,
  pinned: false,
  done: false,
  createdAt: 0,
  updatedAt: 0,
  ...extra,
});

const input = (extra: Partial<StartingPointsInput> = {}): StartingPointsInput => ({
  sessions: [],
  projectPaths: ["C:\\work\\app"],
  currentSessionId: null,
  notes: [],
  ...extra,
});

const kinds = (points: ReturnType<typeof startingPoints>) => points.map((p) => p.kind);

describe("startingPoints", () => {
  it("orders continue, Inbox, then prompts, capped at the maximum", () => {
    const points = startingPoints(input({ sessions: [entry("a")], notes: [note("n")] }));
    expect(kinds(points)).toEqual(["continue", "note", "prompt", "prompt"]);
    expect(points).toHaveLength(MAX_STARTING_POINTS);
    expect(points[2]).toEqual({ kind: "prompt", prompt: STARTER_PROMPTS[0] });
  });

  it("fills the free slots with starter prompts", () => {
    expect(kinds(startingPoints(input()))).toEqual(["prompt", "prompt", "prompt"]);
    expect(kinds(startingPoints(input({ notes: [note("n")] })))).toEqual([
      "note",
      "prompt",
      "prompt",
      "prompt",
    ]);
  });

  it("never goes past the maximum, however many prompts there are", () => {
    const prompts = Array.from({ length: 9 }, (_, i) => ({ label: `${i}`, text: `${i}` }));
    expect(startingPoints(input({ prompts }))).toHaveLength(MAX_STARTING_POINTS);
  });

  it("is empty without a folder, history or notes", () => {
    expect(startingPoints(input({ projectPaths: [] }))).toEqual([]);
  });

  it("offers no prompts and no conversation without a folder, but keeps the note", () => {
    const points = startingPoints(
      input({ projectPaths: [], sessions: [entry("a")], notes: [note("n")] }),
    );
    expect(kinds(points)).toEqual(["note"]);
  });

  describe("continue", () => {
    it("is the newest conversation of the open project, its worktrees included", () => {
      const sessions = [
        entry("other", { cwd: "C:\\work\\elsewhere" }),
        entry("wt", { cwd: "C:/Work/App-wt/" }),
        entry("repo"),
      ];
      const points = startingPoints(
        input({ sessions, projectPaths: ["C:\\work\\app", "C:\\work\\app-wt"] }),
      );
      expect(points[0]).toEqual({ kind: "continue", entry: sessions[1] });
    });

    it("skips archived conversations and the chat on screen", () => {
      const sessions = [entry("current"), entry("old", { archived: true }), entry("b")];
      const points = startingPoints(input({ sessions, currentSessionId: "current" }));
      expect(points[0]).toEqual({ kind: "continue", entry: sessions[2] });
    });

    it("is absent when the project has no other conversation", () => {
      const sessions = [entry("current"), entry("x", { cwd: "D:\\x" })];
      const points = startingPoints(input({ sessions, currentSessionId: "current" }));
      expect(kinds(points)).not.toContain("continue");
    });
  });

  describe("Inbox", () => {
    it("is the pinned open note first, else the newest open one", () => {
      const notes = [note("new", { createdAt: 3 }), note("pin", { pinned: true, createdAt: 1 })];
      expect(startingPoints(input({ notes }))[0]).toEqual({ kind: "note", note: notes[1] });
      const unpinned = [note("old", { createdAt: 1 }), note("new", { createdAt: 3 })];
      expect(startingPoints(input({ notes: unpinned }))[0]).toEqual({
        kind: "note",
        note: unpinned[1],
      });
    });

    it("is absent when every note is done or blank", () => {
      const notes = [note("done", { done: true, pinned: true }), note("blank", { text: " \n " })];
      expect(kinds(startingPoints(input({ notes })))).not.toContain("note");
    });
  });
});

describe("noteLine", () => {
  it("takes the first line with text", () => {
    expect(noteLine("\n  first  \nsecond")).toBe("first");
    expect(noteLine("   ")).toBe("");
  });
});
