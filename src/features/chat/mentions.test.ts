import { describe, expect, it } from "vitest";
import { mentionFor } from "./mentions";

describe("mentionFor", () => {
  it("is relative inside the working folder, whatever the slashes and case", () => {
    expect(mentionFor("C:\\proj\\src\\a.ts", "c:/Proj")).toBe("@src/a.ts");
  });

  it("stays absolute outside it and quotes spaces", () => {
    expect(mentionFor("D:\\other\\b.ts", "C:\\proj")).toBe("@D:/other/b.ts");
    expect(mentionFor("C:\\proj\\my notes.md", "C:\\proj\\")).toBe('@"my notes.md"');
    expect(mentionFor("C:\\x.ts", null)).toBe("@C:/x.ts");
  });
});
