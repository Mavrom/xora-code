import { describe, expect, it } from "vitest";
import type { SessionView } from "./reducer";
import { sessionsToClose } from "./sessionReaper";

const view = (sessionId: string, extra: Partial<SessionView> = {}) =>
  ({
    sessionId,
    turn: "idle",
    loading: false,
    permissions: [],
    queued: [],
    ...extra,
  }) as unknown as SessionView;

const map = (...views: SessionView[]) => Object.fromEntries(views.map((v) => [v.sessionId, v]));

describe("sessionsToClose", () => {
  it("keeps the most recently shown idle sessions and the active one", () => {
    const sessions = map(view("a"), view("b"), view("c"), view("d"));
    expect(sessionsToClose(sessions, "a", ["a", "c", "b", "d"], 2)).toEqual(["d"]);
  });

  it("never closes a running, loading, waiting or queued session", () => {
    const sessions = map(
      view("run", { turn: "running" }),
      view("load", { loading: true }),
      view("ask", { permissions: [{}] as SessionView["permissions"] }),
      view("queue", { queued: [[]] as SessionView["queued"] }),
      view("idle"),
    );
    expect(sessionsToClose(sessions, null, [], 0)).toEqual(["idle"]);
  });

  it("closes never-shown sessions first", () => {
    const sessions = map(view("warm"), view("seen"));
    expect(sessionsToClose(sessions, null, ["seen"], 1)).toEqual(["warm"]);
  });
});
