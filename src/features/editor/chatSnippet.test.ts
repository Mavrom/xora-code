import { describe, expect, it } from "vitest";
import { chatSnippet, displayPath } from "./chatSnippet";

describe("chatSnippet", () => {
  it("heads the block with the relative path and line range", () => {
    const text = chatSnippet({
      path: String.raw`C:\proj\src\a.ts`,
      root: String.raw`C:\proj`,
      startLine: 3,
      endLine: 5,
      language: "typescript",
      code: "const a = 1;\n",
    });
    expect(text).toBe("`src/a.ts:3-5`\n```ts\nconst a = 1;\n```");
  });

  it("uses one line number for a single line and outfences inner backticks", () => {
    const text = chatSnippet({
      path: "/x/readme.md",
      root: null,
      startLine: 7,
      endLine: 7,
      language: "markdown",
      code: "```js\nx\n```",
    });
    expect(text.startsWith("`/x/readme.md:7`\n````markdown\n")).toBe(true);
    expect(text.endsWith("\n````")).toBe(true);
  });

  it("keeps paths outside the folder absolute", () => {
    expect(displayPath("D:/other/f.ts", "C:/proj")).toBe("D:/other/f.ts");
  });
});
