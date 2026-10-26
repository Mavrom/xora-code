import { describe, expect, it } from "vitest";
import { deriveControls } from "./controls";
import {
  FIXTURE_SCENARIOS,
  FIXTURE_SETUPS,
  chunkText,
  createFixtureIpc,
  fixtureSessionView,
} from "./fixtures";
import { AUTH_REQUIRED_PREFIX, isAuthRequired, stripAuthPrefix } from "./ipc";
import type { AgentEvent } from "./types";

describe("fixture setups", () => {
  it("give each agent the controls the adapters really expose", () => {
    const claude = deriveControls(FIXTURE_SETUPS.claude);
    expect([claude.model?.via, claude.mode?.via, claude.effort?.key]).toEqual([
      "config",
      "config",
      "effort",
    ]);
    const codex = deriveControls(FIXTURE_SETUPS.codex);
    expect(codex.effort?.key).toBe("reasoning_effort");
    expect(codex.extra.map((c) => c.key)).toEqual(["fast-mode", "collaboration_mode"]);
    const gemini = deriveControls(FIXTURE_SETUPS.gemini);
    expect([gemini.model?.via, gemini.mode?.via, gemini.effort]).toEqual([
      "model",
      "mode",
      undefined,
    ]);
  });
});

describe("fixture scenarios", () => {
  it("chunks text without losing characters", () => {
    const text = "Merhaba dünya, bu bir akış denemesi.\n\n```ts\nconst x = 1;\n```";
    expect(chunkText(text).join("")).toBe(text);
  });

  it("build session views", () => {
    const streaming = fixtureSessionView("streaming");
    expect(streaming.turn).toBe("idle");
    expect(streaming.items.map((i) => i.kind)).toEqual(["user", "thought", "tool", "agent"]);
    expect(streaming.title).toBe("README'yi özetle");

    const permission = fixtureSessionView("permission");
    expect(permission.turn).toBe("running");
    expect(permission.permissions).toHaveLength(1);

    const diff = fixtureSessionView("toolDiff");
    expect(diff.changes).toHaveLength(1);
    expect(diff.terminals["term-1"].exited).toBe(true);
  });

  it("every scenario ends its turn", () => {
    for (const s of Object.values(FIXTURE_SCENARIOS)) {
      expect(s.events[s.events.length - 1].type).toBe("turnEnded");
    }
  });
});

describe("fixture ipc", () => {
  it("plays a scenario and waits at the permission prompt", async () => {
    const ipc = createFixtureIpc({ scenario: "permission", stepMs: 0 });
    const events: AgentEvent[] = [];
    await ipc.subscribe((e) => events.push(e));
    const setup = await ipc.sessionNew("claude", "C:\\x");
    await ipc.prompt(setup.sessionId, [{ type: "text", text: "hi" }]);
    await new Promise((r) => setTimeout(r, 50));
    const req = events.find((e) => e.type === "permissionRequested");
    expect(req && req.type === "permissionRequested" && req.sessionId).toBe(setup.sessionId);
    expect(events.some((e) => e.type === "turnEnded")).toBe(false);
    if (req?.type !== "permissionRequested") return;
    await ipc.permissionRespond(req.requestId, "allow");
    await new Promise((r) => setTimeout(r, 50));
    expect(events[events.length - 1]).toEqual({
      type: "turnEnded",
      sessionId: setup.sessionId,
      stopReason: "end_turn",
    });
  });
});

describe("auth errors", () => {
  it("detects and strips the auth prefix", () => {
    expect(isAuthRequired(`${AUTH_REQUIRED_PREFIX} sign in`)).toBe(true);
    expect(isAuthRequired(new Error("auth_required: x"))).toBe(true);
    expect(isAuthRequired("boom")).toBe(false);
    expect(stripAuthPrefix("auth_required: sign in")).toBe("sign in");
  });
});
