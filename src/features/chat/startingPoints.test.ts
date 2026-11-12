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
  it("orders Inbox, then prompts, capped at the maximum", () => {
    const points = startingPoints(input({ notes: [note("n")] }));
    expect(kinds(points)).toEqual(["note", "prompt", "prompt"]);
    expect(points).toHaveLength(MAX_STARTING_POINTS);
    expect(points[1]).toEqual({ kind: "prompt", prompt: STARTER_PROMPTS[0] });
  });

  it("fills the free slots with starter prompts", () => {
    expect(kinds(startingPoints(input()))).toEqual(["prompt", "prompt", "prompt"]);
  });

  it("never goes past the maximum, however many prompts there are", () => {
    const prompts = Array.from({ length: 9 }, (_, i) => ({ label: `${i}`, text: `${i}` }));
    expect(startingPoints(input({ prompts }))).toHaveLength(MAX_STARTING_POINTS);
  });

  it("is empty without a folder, history or notes", () => {
    expect(startingPoints(input({ projectPaths: [] }))).toEqual([]);
  });

  it("offers no prompts without a folder, but keeps the note", () => {
    const points = startingPoints(
      input({ projectPaths: [], sessions: [entry("a")], notes: [note("n")] }),
    );
    expect(kinds(points)).toEqual(["note"]);
  });

  describe("a returning user", () => {
    it("gets none once the project has a conversation, its worktrees and archive included", () => {
      const notes = [note("n")];
      expect(startingPoints(input({ sessions: [entry("a")], notes }))).toEqual([]);
      expect(
        startingPoints(
          input({
            sessions: [entry("wt", { cwd: "C:/Work/App-wt/" })],
            projectPaths: ["C:\\work\\app", "C:\\work\\app-wt"],
            notes,
          }),
        ),
      ).toEqual([]);
      expect(startingPoints(input({ sessions: [entry("old", { archived: true })] }))).toEqual([]);
    });

    it("does not count the chat on screen or other projects' chats", () => {
      const sessions = [entry("current"), entry("x", { cwd: "D:\\x" })];
      const points = startingPoints(input({ sessions, currentSessionId: "current" }));
      expect(kinds(points)).toEqual(["prompt", "prompt", "prompt"]);
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
