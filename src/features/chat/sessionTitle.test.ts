import { describe, expect, it } from "vitest";
import { shortTitle } from "./sessionTitle";

describe("shortTitle", () => {
  it("keeps short text as it is", () => {
    expect(shortTitle("README'yi özetle")).toBe("README'yi özetle");
  });

  it("takes the first sentence or line", () => {
    expect(shortTitle("Testleri çalıştır. Sonra commit at")).toBe("Testleri çalıştır.");
    expect(shortTitle("Hata var\nşu dosyada")).toBe("Hata var");
  });

  it("cuts long text at a word boundary", () => {
    const title = shortTitle(
      "bu tarz bir görsel üretmeni istiyorum ama aynısı benzeri değil böyle bu kalite",
    );
    expect(title).toBe("bu tarz bir görsel üretmeni istiyorum…");
    expect(title.length).toBeLessThanOrEqual(41);
  });

  it("cuts a single long word hard", () => {
    expect(shortTitle("a".repeat(60), 10)).toBe(`${"a".repeat(10)}…`);
  });
});
