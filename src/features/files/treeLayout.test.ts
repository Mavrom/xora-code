import { describe, expect, it } from "vitest";
import { indentOf, isDimmed } from "./treeLayout";
import type { TreeRow } from "./treeModel";

const node = (path: string, ancestors: string[] = []): TreeRow => ({
  kind: "node",
  key: path,
  node: {
    entry: { name: path.split("/").pop() ?? path, path, isDir: true },
    depth: ancestors.length,
    parentPath: ancestors[ancestors.length - 1] ?? null,
    setSize: 1,
    posInSet: 1,
  },
  ancestors,
});

describe("isDimmed", () => {
  it("dims a noisy folder itself", () => {
    expect(isDimmed(node("/w/node_modules"))).toBe(true);
    expect(isDimmed(node("/w/src"))).toBe(false);
  });

  it("dims everything inside a noisy folder, with either separator", () => {
    expect(isDimmed(node("/w/target/debug", ["/w/target"]))).toBe(true);
    expect(isDimmed(node("C:\\w\\dist\\a", ["C:\\w\\dist"]))).toBe(true);
    expect(isDimmed({ kind: "loading", key: "k", depth: 1, ancestors: ["/w/.claude"] })).toBe(true);
  });

  it("matches whole names only", () => {
    expect(isDimmed(node("/w/distro"))).toBe(false);
    expect(isDimmed(node("/w/src/a", ["/w/src"]))).toBe(false);
  });
});

describe("indentOf", () => {
  it("adds one indent step per level after the row padding", () => {
    expect(indentOf(0)).toBe(8);
    expect(indentOf(2)).toBe(36);
  });
});
