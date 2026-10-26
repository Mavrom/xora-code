import { describe, expect, it } from "vitest";
import { mentionToken, removeMention } from "./mention";

describe("mentionToken", () => {
  it("finds an @ at the start or after a space", () => {
    expect(mentionToken("@lay", 4)).toEqual({ start: 0, query: "lay" });
    expect(mentionToken("bak @src/app", 12)).toEqual({ start: 4, query: "src/app" });
    expect(mentionToken("bak @", 5)).toEqual({ start: 4, query: "" });
  });

  it("ignores e-mail addresses, spaces after the @ and text past the caret", () => {
    expect(mentionToken("me@x.com", 8)).toBeNull();
    expect(mentionToken("@lay out", 8)).toBeNull();
    expect(mentionToken("plain text", 10)).toBeNull();
  });
});

describe("removeMention", () => {
  it("takes the token out and puts the caret where it began", () => {
    const value = "şuna bak @lay ve düzelt";
    const token = mentionToken(value, 13)!;
    expect(removeMention(value, token, 13)).toEqual({ text: "şuna bak ve düzelt", caret: 9 });
  });
});
