import { describe, expect, it } from "vitest";
import { isInsideRoot, makeSession, MAX_SESSION_TABS, parseSession } from "./session";

describe("workspace session", () => {
  it("keeps only tabs inside the root and a valid active tab", () => {
    const s = makeSession(
      "C:\\p",
      ["C:\\p\\a.ts", "D:\\other.ts", "C:\\p\\src\\b.ts"],
      "D:\\other.ts",
    );
    expect(s).toEqual({
      root: "C:\\p",
      tabs: ["C:\\p\\a.ts", "C:\\p\\src\\b.ts"],
      active: "C:\\p\\src\\b.ts",
    });
    expect(makeSession("/p", [], null)).toEqual({ root: "/p", tabs: [], active: null });
  });

  it("caps the number of tabs", () => {
    const paths = Array.from({ length: 30 }, (_, i) => `/p/${i}.ts`);
    expect(makeSession("/p", paths, null).tabs).toHaveLength(MAX_SESSION_TABS);
  });

  it("round-trips through JSON and rejects other roots or junk", () => {
    const s = makeSession("/p", ["/p/a.ts"], "/p/a.ts");
    expect(parseSession(JSON.stringify(s), "/P/")).toEqual({ ...s, root: "/P/" });
    expect(parseSession(JSON.stringify(s), "/q")).toBeNull();
    expect(parseSession("{", "/p")).toBeNull();
    expect(parseSession("null", "/p")).toBeNull();
    expect(parseSession(null, "/p")).toBeNull();
    expect(parseSession('{"root":"/p","tabs":[1,"/p/x.ts"],"active":5}', "/p")).toEqual({
      root: "/p",
      tabs: ["/p/x.ts"],
      active: "/p/x.ts",
    });
  });

  it("tests containment loosely but not by prefix alone", () => {
    expect(isInsideRoot("C:\\P\\a.ts", "c:/p/")).toBe(true);
    expect(isInsideRoot("C:\\pp\\a.ts", "C:\\p")).toBe(false);
    expect(isInsideRoot("C:\\p", "C:\\p")).toBe(false);
  });
});
