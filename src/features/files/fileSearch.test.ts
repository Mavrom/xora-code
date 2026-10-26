import { describe, expect, it } from "vitest";
import { indexFiles, searchFiles } from "./fileSearch";

const files = indexFiles([
  "README.md",
  "src/app/Layout.tsx",
  "src/app/Sidebar.tsx",
  "src/features/chat/ChatPanel.tsx",
  "src/features/chat/chat.css",
  "docs/layout-notes.md",
  "src-tauri/src/fs/index.rs",
]);

const paths = (q: string) => searchFiles(q, files).map((h) => h.path);

describe("searchFiles", () => {
  it("prefers a file name match", () => {
    expect(paths("layout")[0]).toBe("src/app/Layout.tsx");
    expect(paths("layout")).toContain("docs/layout-notes.md");
  });

  it("matches fuzzy across the path", () => {
    expect(paths("chatpan")[0]).toBe("src/features/chat/ChatPanel.tsx");
    expect(paths("fsidx")[0]).toBe("src-tauri/src/fs/index.rs");
  });

  it("highlights inside the file name when it can", () => {
    const hit = searchFiles("side", files)[0];
    expect(hit.path).toBe("src/app/Sidebar.tsx");
    expect(hit.positions.every((p) => p >= "src/app/".length)).toBe(true);
  });

  it("drops non-matches and lists files for an empty query", () => {
    expect(paths("zzz")).toEqual([]);
    expect(searchFiles("", files, 2)).toHaveLength(2);
  });

  it("stays fast on a large tree", () => {
    const big = indexFiles(
      Array.from({ length: 50_000 }, (_, i) => `packages/p${i % 300}/src/module${i}/file${i}.ts`),
    );
    const start = performance.now();
    searchFiles("mod42fil", big);
    expect(performance.now() - start).toBeLessThan(400);
  });
});
