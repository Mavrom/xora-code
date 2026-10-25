import { describe, expect, it } from "vitest";
import { basename, extname } from "./path";

describe("basename", () => {
  it("handles windows and posix separators", () => {
    expect(basename("C:\\proj\\src\\a.ts")).toBe("a.ts");
    expect(basename("/proj/src/b.ts")).toBe("b.ts");
    expect(basename("plain")).toBe("plain");
  });
});

describe("extname", () => {
  it("returns lowercase extension without dot", () => {
    expect(extname("a/B.TSX")).toBe("tsx");
    expect(extname("C:\\x\\archive.tar.gz")).toBe("gz");
  });

  it("returns empty string for dotfiles and extensionless names", () => {
    expect(extname(".gitignore")).toBe("");
    expect(extname("Makefile")).toBe("");
  });
});
