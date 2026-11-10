import { describe, expect, it } from "vitest";
import type { SessionView } from "@/features/agents/reducer";
import { attentionCount, nextUnread, sessionStatus } from "./sessionStatus";

const view = (extra: Partial<SessionView> = {}) =>
  ({ turn: "idle", permissions: [], error: null, ...extra }) as unknown as SessionView;

const asking = { permissions: [{}] as SessionView["permissions"] };
const failed = { error: { message: "boom", code: null } };

describe("sessionStatus", () => {
  it("ranks approval over running over failed over unread", () => {
    expect(sessionStatus(view({ turn: "running", ...asking, ...failed }), true)).toBe("approval");
    expect(sessionStatus(view({ turn: "running", ...failed }), true)).toBe("running");
    expect(sessionStatus(view({ turn: "cancelling" }), false)).toBe("running");
    expect(sessionStatus(view(failed), true)).toBe("failed");
    expect(sessionStatus(view(), true)).toBe("unread");
    expect(sessionStatus(view(), false)).toBe("idle");
  });

  it("treats sessions that are not open as idle", () => {
    expect(sessionStatus(undefined, true)).toBe("idle");
  });
});

describe("nextUnread", () => {
  const none: ReadonlySet<string> = new Set();
  const running = { a: view({ turn: "running" }), b: view() };
  const done = { a: view(), b: view() };

  it("marks a chat that finishes while another one is active", () => {
    expect([...nextUnread(none, running, done, "b")]).toEqual(["a"]);
  });

  it("marks a failed turn too", () => {
    expect([...nextUnread(none, running, { ...done, a: view(failed) }, null)]).toEqual(["a"]);
  });

  it("clears it once the chat becomes active", () => {
    const unread = new Set(["a"]);
    expect(nextUnread(unread, done, done, "a").size).toBe(0);
  });

  it("never marks the active chat, focused or not", () => {
    expect(nextUnread(none, running, done, "a")).toBe(none);
  });

  it("drops a session that leaves the store", () => {
    const unread = new Set(["a"]);
    expect(nextUnread(unread, done, { b: view() }, "b").size).toBe(0);
  });

  it("keeps the same set when nothing changed", () => {
    const unread = new Set(["a"]);
    expect(nextUnread(unread, running, running, "b")).toBe(unread);
    expect(nextUnread(unread, done, done, "b")).toBe(unread);
  });

  it("ignores sessions that are new or still running", () => {
    expect(nextUnread(none, {}, done, null)).toBe(none);
    expect(nextUnread(none, running, running, null)).toBe(none);
  });
});

describe("attentionCount", () => {
  it("counts approvals and unseen results, not running chats", () => {
    const sessions = {
      a: view({ turn: "running", ...asking }),
      b: view(),
      c: view({ turn: "running" }),
      d: view(failed),
      e: view(),
    };
    expect(attentionCount(sessions, new Set(["b", "c", "d"]))).toBe(3);
  });
});
