import { describe, expect, it } from "vitest";
import { attentionFor } from "./attention";
import type { SessionView } from "./reducer";

const view = (extra: Partial<SessionView> = {}) =>
  ({ turn: "idle", permissions: [], ...extra }) as unknown as SessionView;

describe("attentionFor", () => {
  it("reports a finished turn", () => {
    expect(attentionFor({ a: view({ turn: "running" }) }, { a: view() })).toBe("done");
  });

  it("prefers a new approval request", () => {
    const prev = { a: view({ turn: "running" }), b: view({ turn: "running" }) };
    const next = {
      a: view(),
      b: view({ turn: "running", permissions: [{}] as SessionView["permissions"] }),
    };
    expect(attentionFor(prev, next)).toBe("approval");
  });

  it("ignores new sessions and quiet updates", () => {
    expect(attentionFor({}, { a: view() })).toBeNull();
    expect(
      attentionFor({ a: view({ turn: "running" }) }, { a: view({ turn: "running" }) }),
    ).toBeNull();
  });
});
