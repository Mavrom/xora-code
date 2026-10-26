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
    });
    expect(fixtureParams("?fixture=welcome&agent=gemini&status=crashed")).toEqual({
      fixture: "welcome",
      agent: "gemini",
      status: "crashed",
    });
    expect(fixtureParams("?fixture=&agent=bogus")?.agent).toBe("claude");
  });
});
