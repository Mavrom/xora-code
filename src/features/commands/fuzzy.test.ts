import { describe, expect, it } from "vitest";
import { fold, fuzzyMatch, fuzzyScore } from "./fuzzy";

const score = (q: string, t: string) => fuzzyScore(q, t) ?? -Infinity;

describe("fold", () => {
  it("lowercases and strips Turkish diacritics one char per char", () => {
    expect(fold("Klasör AÇ İı Şğü")).toBe("klasor ac ii sgu");
    expect(fold("İnbox").length).toBe("İnbox".length);
  });
});

describe("fuzzyScore", () => {
  it("matches everything with an empty or blank query", () => {
    expect(fuzzyScore("", "Klasör aç")).toBe(0);
    expect(fuzzyScore("   ", "Klasör aç")).toBe(0);
  });

  it("returns null when the query is not a subsequence", () => {
    expect(fuzzyScore("xyz", "Klasör aç")).toBeNull();
    expect(fuzzyScore("ca", "ac")).toBeNull();
    expect(fuzzyScore("abc", "ab")).toBeNull();
  });

  it("is case-insensitive and ignores Turkish diacritics", () => {
    expect(fuzzyScore("klasor ac", "Klasör aç")).not.toBeNull();
    expect(fuzzyScore("INBOX", "Inbox'a geç")).not.toBeNull();
    expect(fuzzyScore("editoru", "Editörü göster/gizle")).not.toBeNull();
    expect(fuzzyScore("dosyayi", "Aktif dosyayı kaydet")).not.toBeNull();
    expect(fuzzyScore("ı", "Inbox")).not.toBeNull();
  });

  it("reports matched positions in the original text", () => {
    expect(fuzzyMatch("aç", "Klasör aç")?.positions).toEqual([7, 8]);
    expect(fuzzyMatch("gec", "Explorer'a geç")?.positions).toEqual([11, 12, 13]);
    expect(fuzzyMatch("", "x")?.positions).toEqual([]);
  });

  it("treats camelCase humps as word starts", () => {
    expect(score("fb", "fooBar")).toBeGreaterThan(score("fb", "foobar"));
  });

  it("ignores whitespace in the query", () => {
    expect(fuzzyScore("kl aç", "Klasör aç")).toBe(fuzzyScore("klaç", "Klasör aç"));
  });

  it("prefers contiguous matches over scattered ones", () => {
    expect(score("abc", "abc def")).toBeGreaterThan(score("abc", "axbxc def"));
  });

  it("prefers a prefix over a match in the middle of a word", () => {
    expect(score("ed", "edit")).toBeGreaterThan(score("ed", "credit"));
  });

  it("prefers word starts over mid-word letters", () => {
    expect(score("sk", "Aktif sekmeyi kapat")).toBeGreaterThan(score("sk", "Aktif dosyayı kaydet"));
  });

  it("finds the best alignment, not the first greedy one", () => {
    // Greedy would take the "a" of "Klasör"; the word-start "aç" is the better fit.
    expect(score("aç", "Klasör aç")).toBeGreaterThan(score("aç", "Klasör xaç"));
    expect(score("aç", "Klasör aç")).toBeCloseTo(score("aç", "Klxsxr aç"));
  });

  it("scores an exact title highest", () => {
    expect(score("yeni not", "Yeni not")).toBeGreaterThan(score("yeni not", "Yeni bir not"));
  });
});
