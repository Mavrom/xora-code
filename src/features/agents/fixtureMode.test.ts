import { describe, expect, it } from "vitest";
import { fixtureParams } from "./fixtureMode";

describe("fixtureParams", () => {
  it("is null without the param", () => {
    expect(fixtureParams("")).toBeNull();
    expect(fixtureParams("?x=1")).toBeNull();
  });

  it("parses scenario, agent and status", () => {
    expect(fixtureParams("?fixture=permission")).toEqual({
      fixture: "permission",
      agent: "claude",
      status: null,
      branch: false,
      history: true,
      view: null,
    });
    expect(fixtureParams("?fixture=welcome&agent=gemini&status=crashed")).toEqual({
      fixture: "welcome",
      agent: "gemini",
      status: "crashed",
      branch: false,
      history: true,
      view: null,
    });
    expect(fixtureParams("?fixture=&agent=bogus")?.agent).toBe("claude");
    expect(fixtureParams("?fixture=toolRun&branch=1")?.branch).toBe(true);
  });

  it("parses a first run and the sidebar view", () => {
    expect(fixtureParams("?fixture=welcome&history=0")?.history).toBe(false);
    expect(fixtureParams("?fixture=toolDiff&view=changes")?.view).toBe("changes");
    expect(fixtureParams("?fixture=toolDiff&view=bogus")?.view).toBeNull();
  });
});
