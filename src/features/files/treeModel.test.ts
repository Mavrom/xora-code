import { describe, expect, it } from "vitest";
import type { DirEntry } from "@/shared/lib/ipc";
import {
  activeGuideDepth,
  affectedDirs,
  buildTreeRows,
  findByPrefix,
  flattenVisible,
  keyAction,
  parentDir,
  resolveTabStop,
  type DirListing,
  type TreeRow,
  type VisibleNode,
} from "./treeModel";

const dir = (path: string): DirEntry => ({ name: path.split("/").pop()!, path, isDir: true });
const file = (path: string): DirEntry => ({ name: path.split("/").pop()!, path, isDir: false });
const ok = (...entries: DirEntry[]): DirListing => ({ entries, error: null, loading: false });

// /r
// ├── src/            (expanded)
// │   ├── lib/        (expanded)
// │   │   └── path.ts
// │   └── main.ts
// ├── docs/           (collapsed, already listed)
// ├── empty/          (expanded, no entries)
// └── README.md
const listings = new Map<string, DirListing>([
  ["/r", ok(dir("/r/src"), dir("/r/docs"), dir("/r/empty"), file("/r/README.md"))],
  ["/r/src", ok(dir("/r/src/lib"), file("/r/src/main.ts"))],
  ["/r/src/lib", ok(file("/r/src/lib/path.ts"))],
  ["/r/docs", ok(file("/r/docs/guide.md"))],
  ["/r/empty", ok()],
]);
const expanded = new Set(["/r/src", "/r/src/lib", "/r/empty"]);
const nodes = flattenVisible("/r", listings, expanded);
const paths = (list: VisibleNode[]) => list.map((n) => n.entry.path);
const act = (focused: string | null, key: string) => keyAction(nodes, focused, key, expanded);

describe("flattenVisible", () => {
  it("lists visible nodes depth-first, skipping collapsed folders", () => {
    expect(paths(nodes)).toEqual([
      "/r/src",
      "/r/src/lib",
      "/r/src/lib/path.ts",
      "/r/src/main.ts",
      "/r/docs",
      "/r/empty",
      "/r/README.md",
    ]);
  });

  it("records depth, parent and position within the sibling set", () => {
    const main = nodes.find((n) => n.entry.path === "/r/src/main.ts")!;
    expect(main).toMatchObject({ depth: 1, parentPath: "/r/src", setSize: 2, posInSet: 2 });
    const top = nodes[0];
    expect(top).toMatchObject({ depth: 0, parentPath: null, setSize: 4, posInSet: 1 });
  });

  it("returns nothing while the root is unlisted, and hides children of failed or loading folders", () => {
    expect(flattenVisible("/x", new Map(), new Set())).toEqual([]);
    const broken = new Map(listings);
    broken.set("/r/src", { entries: null, error: "denied", loading: false });
    expect(paths(flattenVisible("/r", broken, expanded))).toEqual([
      "/r/src",
      "/r/docs",
      "/r/empty",
      "/r/README.md",
    ]);
  });

  it("keeps showing cached children while a folder refreshes", () => {
    const refreshing = new Map(listings);
    refreshing.set("/r/src/lib", { ...ok(file("/r/src/lib/path.ts")), loading: true });
    expect(paths(flattenVisible("/r", refreshing, expanded))).toContain("/r/src/lib/path.ts");
  });
});

describe("keyAction", () => {
  it("moves down and up, stopping at the edges", () => {
    expect(act("/r/src", "ArrowDown")).toEqual({ type: "focus", path: "/r/src/lib" });
    expect(act("/r/src/lib", "ArrowUp")).toEqual({ type: "focus", path: "/r/src" });
    expect(act("/r/src", "ArrowUp")).toBeNull();
    expect(act("/r/README.md", "ArrowDown")).toBeNull();
  });

  it("jumps to the first and last visible node with Home/End", () => {
    expect(act("/r/src/main.ts", "Home")).toEqual({ type: "focus", path: "/r/src" });
    expect(act("/r/src", "End")).toEqual({ type: "focus", path: "/r/README.md" });
  });

  it("starts at the first node when nothing is focused", () => {
    expect(act(null, "ArrowDown")).toEqual({ type: "focus", path: "/r/src" });
    expect(act("/gone", "ArrowUp")).toEqual({ type: "focus", path: "/r/src" });
  });

  it("ArrowRight expands a collapsed folder, then enters its first child", () => {
    expect(act("/r/docs", "ArrowRight")).toEqual({ type: "expand", path: "/r/docs" });
    expect(act("/r/src", "ArrowRight")).toEqual({ type: "focus", path: "/r/src/lib" });
    expect(act("/r/empty", "ArrowRight")).toBeNull();
    expect(act("/r/README.md", "ArrowRight")).toBeNull();
  });

  it("ArrowLeft collapses an expanded folder, otherwise goes to the parent", () => {
    expect(act("/r/src/lib", "ArrowLeft")).toEqual({ type: "collapse", path: "/r/src/lib" });
    expect(act("/r/src/lib/path.ts", "ArrowLeft")).toEqual({ type: "focus", path: "/r/src/lib" });
    expect(act("/r/src/main.ts", "ArrowLeft")).toEqual({ type: "focus", path: "/r/src" });
    expect(act("/r/docs", "ArrowLeft")).toBeNull();
  });

  it("Enter and Space open files and toggle folders", () => {
    expect(act("/r/README.md", "Enter")).toEqual({ type: "open", path: "/r/README.md" });
    expect(act("/r/README.md", " ")).toEqual({ type: "open", path: "/r/README.md" });
    expect(act("/r/docs", "Enter")).toEqual({ type: "expand", path: "/r/docs" });
    expect(act("/r/src", " ")).toEqual({ type: "collapse", path: "/r/src" });
  });

  it("ignores unrelated keys", () => {
    expect(act("/r/src", "Tab")).toBeNull();
  });

  it("does nothing on an empty tree", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Enter"]) {
      expect(keyAction([], null, key, new Set())).toBeNull();
      expect(keyAction([], "/r/src", key, new Set())).toBeNull();
    }
  });

  it("ArrowRight stays put on an expanded folder that is still loading", () => {
    const loading = new Map(listings);
    loading.set("/r/docs", { entries: null, error: null, loading: true });
    const open = new Set([...expanded, "/r/docs"]);
    const loadingNodes = flattenVisible("/r", loading, open);
    expect(keyAction(loadingNodes, "/r/docs", "ArrowRight", open)).toBeNull();
  });
});

describe("findByPrefix", () => {
  it("finds the next node whose name starts with the query, wrapping around", () => {
    expect(findByPrefix(nodes, 0, "m")).toBe("/r/src/main.ts");
    expect(findByPrefix(nodes, 4, "s")).toBe("/r/src");
    expect(findByPrefix(nodes, 0, "RE")).toBe("/r/README.md");
    expect(findByPrefix(nodes, 0, "zzz")).toBeNull();
  });
});

describe("findByPrefix diacritics", () => {
  it("folds Turkish letters like the palette", () => {
    const named = flattenVisible(
      "/q",
      new Map([["/q", ok(file("/q/apple.ts"), file("/q/Ünicode-dosya.md"), file("/q/Şema.json"))]]),
      new Set(),
    );
    expect(findByPrefix(named, 0, "u")).toBe("/q/Ünicode-dosya.md");
    expect(findByPrefix(named, 0, "sem")).toBe("/q/Şema.json");
    expect(findByPrefix(named, 0, "ÜNİ")).toBe("/q/Ünicode-dosya.md");
  });
});

describe("buildTreeRows", () => {
  const kinds = (rows: TreeRow[]) =>
    rows.map((r) => (r.kind === "node" ? r.node.entry.path : `${r.kind}:${r.key}`));

  it("matches flattenVisible for nodes and adds the status lines", () => {
    const rows = buildTreeRows("/r", listings, expanded, new Map());
    expect(rows.filter((r) => r.kind === "node").map((r) => r.key)).toEqual(paths(nodes));
    expect(kinds(rows)).toEqual([
      "/r/src",
      "/r/src/lib",
      "/r/src/lib/path.ts",
      "/r/src/main.ts",
      "/r/docs",
      "/r/empty",
      "status:/r/empty::empty",
      "/r/README.md",
    ]);
  });

  it("records ancestors and node metadata like flattenVisible", () => {
    const rows = buildTreeRows("/r", listings, expanded, new Map());
    const pathRow = rows.find((r) => r.key === "/r/src/lib/path.ts");
    expect(pathRow?.ancestors).toEqual(["/r/src", "/r/src/lib"]);
    expect(pathRow?.kind === "node" && pathRow.node).toMatchObject({
      depth: 2,
      parentPath: "/r/src/lib",
    });
  });

  it("adds loading, folder error and file read error rows", () => {
    const l = new Map(listings);
    l.set("/r/src/lib", { entries: null, error: null, loading: true });
    l.set("/r/empty", { entries: null, error: "denied", loading: false });
    const rows = buildTreeRows("/r", l, expanded, new Map([["/r/README.md", "gone"]]));
    expect(kinds(rows)).toEqual([
      "/r/src",
      "/r/src/lib",
      "loading:/r/src/lib::loading",
      "/r/src/main.ts",
      "/r/docs",
      "/r/empty",
      "status:/r/empty::error",
      "/r/README.md",
      "status:/r/README.md::read-error",
    ]);
    const readError = rows[rows.length - 1];
    expect(readError).toMatchObject({ tone: "danger", text: "gone", underName: true, depth: 0 });
  });

  it("leaves the root's own error and loading state to the caller", () => {
    const failed = new Map([["/r", { entries: null, error: "denied", loading: false }]]);
    expect(buildTreeRows("/r", failed, new Set(), new Map())).toEqual([]);
    const loading = new Map([["/r", { entries: null, error: null, loading: true }]]);
    expect(kinds(buildTreeRows("/r", loading, new Set(), new Map()))).toEqual([
      "loading:/r::loading",
    ]);
  });
});

describe("parentDir / affectedDirs", () => {
  it("finds the parent folder with either separator", () => {
    expect(parentDir("/r/src/a.ts")).toBe("/r/src");
    expect(parentDir("C:\\p\\a.ts")).toBe("C:\\p");
    expect(parentDir("C:\\a.ts")).toBe("C:\\");
    expect(parentDir("/a")).toBeNull();
  });

  it("maps changed paths to the listed folders that must re-list", () => {
    const listed = ["/r", "/r/src", "/r/docs"];
    expect(affectedDirs(["/r/src/new.ts"], listed, false)).toEqual(["/r/src"]);
    expect(affectedDirs(["/r/docs"], listed, false).sort()).toEqual(["/r", "/r/docs"]);
    expect(affectedDirs(["/r/elsewhere/x.ts"], listed, false)).toEqual([]);
    expect(affectedDirs([], listed, true)).toEqual(listed);
  });

  it("matches across separator style and case", () => {
    expect(affectedDirs(["c:/P/Src/a.ts"], ["C:\\p\\src"], false)).toEqual(["C:\\p\\src"]);
  });
});

describe("activeGuideDepth", () => {
  it("counts the ancestors that contain the active file", () => {
    expect(activeGuideDepth(["/r/src", "/r/src/lib"], "/r/src/lib/path.ts")).toBe(2);
    expect(activeGuideDepth(["/r/src", "/r/src/lib"], "/r/src/main.ts")).toBe(1);
    expect(activeGuideDepth(["/r/src"], "/r/srcx/a.ts")).toBe(0);
    expect(activeGuideDepth(["/r/src"], null)).toBe(0);
  });
});

describe("resolveTabStop", () => {
  it("prefers the focused node, then the active file, then the first node", () => {
    expect(resolveTabStop(nodes, "/r/docs", "/r/README.md")).toBe("/r/docs");
    expect(resolveTabStop(nodes, "/r/docs/guide.md", "/r/README.md")).toBe("/r/README.md");
    expect(resolveTabStop(nodes, null, "/elsewhere")).toBe("/r/src");
    expect(resolveTabStop([], null, null)).toBeNull();
  });
});
