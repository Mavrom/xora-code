import { describe, expect, it } from "vitest";
import { closeOpenFence, openFence, splitBlocks } from "./markdown";

describe("splitBlocks", () => {
  it("splits paragraphs at blank lines and drops extra blank lines", () => {
    expect(splitBlocks("Bir.\n\n\n\nİki\nüç.")).toEqual(["Bir.", "İki\nüç."]);
  });

  it("returns nothing for empty or whitespace-only text", () => {
    expect(splitBlocks("")).toEqual([]);
    expect(splitBlocks("\n  \n")).toEqual([]);
  });

  it("keeps a fenced code block whole, blank lines included", () => {
    const text = "Önce:\n\n```ts\nconst a = 1;\n\nconst b = 2;\n```\n\nSonra.";
    expect(splitBlocks(text)).toEqual([
      "Önce:",
      "```ts\nconst a = 1;\n\nconst b = 2;\n```",
      "Sonra.",
    ]);
  });

  it("runs an unterminated fence to the end of the text", () => {
    expect(splitBlocks("```js\nlet x;\n\nx = 1")).toEqual(["```js\nlet x;\n\nx = 1"]);
  });

  it("only closes a fence with the same character and at least the same length", () => {
    const text = "````md\n```\ninner\n```\n\n````\n\nafter";
    expect(splitBlocks(text)).toEqual(["````md\n```\ninner\n```\n\n````", "after"]);
    expect(splitBlocks("~~~\na\n```\n\nb\n~~~")).toEqual(["~~~\na\n```\n\nb\n~~~"]);
  });

  it("keeps a loose list together and indented continuations attached", () => {
    const text = "- bir\n\n- iki\n\n  devamı\n\nParagraf";
    expect(splitBlocks(text)).toEqual(["- bir\n\n- iki\n\n  devamı", "Paragraf"]);
  });

  it("keeps ordered loose lists together", () => {
    expect(splitBlocks("1. a\n\n2. b")).toEqual(["1. a\n\n2. b"]);
  });

  it("normalises CRLF line endings", () => {
    expect(splitBlocks("a\r\n\r\nb")).toEqual(["a", "b"]);
  });

  it("starts a fence mid-paragraph without a blank line", () => {
    expect(splitBlocks("Kod:\n```\nx\n\ny\n```\n\nson")).toEqual(["Kod:\n```\nx\n\ny\n```", "son"]);
  });
});

describe("openFence / closeOpenFence", () => {
  it("detects an open fence and closes it with the same marker", () => {
    expect(openFence("```ts\nlet a")).toBe("```");
    expect(closeOpenFence("````\nx")).toBe("````\nx\n````");
    expect(closeOpenFence("~~~py\nx")).toBe("~~~py\nx\n~~~");
  });

  it("leaves closed fences and plain text untouched", () => {
    expect(openFence("```\nx\n```")).toBeNull();
    expect(closeOpenFence("plain")).toBe("plain");
  });
});
