import { describe, expect, it } from "vitest";
import { totalStats } from "./turnChanges";

describe("totalStats", () => {
  it("sums the lines of every change with both sides known", () => {
    expect(
      totalStats([
        { path: "/a", oldText: "x\ny\n", newText: "x\nz\nw\n" },
        { path: "/b", oldText: null, newText: "new\n" },
        { path: "/c", oldText: undefined, newText: "skipped\n" },
      ]),
    ).toEqual({ added: 3, removed: 1 });
  });

  it("is zero for no changes", () => {
    expect(totalStats([])).toEqual({ added: 0, removed: 0 });
  });
});
