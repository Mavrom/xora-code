import { describe, expect, it } from "vitest";
import { saveErrorMessage, secondsUntil } from "./retryCountdown";

describe("save retry countdown", () => {
  it("rounds partial seconds up so the count never shows 0 too early", () => {
    expect(secondsUntil(15_000, 0)).toBe(15);
    expect(secondsUntil(15_000, 1)).toBe(15);
    expect(secondsUntil(15_000, 14_001)).toBe(1);
    expect(secondsUntil(15_000, 15_000)).toBe(0);
    expect(secondsUntil(15_000, 20_000)).toBe(0);
  });

  it("names the wait while a retry is pending", () => {
    expect(saveErrorMessage(15_000, 0)).toBe("Kaydedilemedi · 15 sn içinde tekrar denenecek");
  });

  it("says it is retrying once the time is up", () => {
    expect(saveErrorMessage(15_000, 15_000)).toBe("Kaydedilemedi · tekrar deneniyor…");
  });

  it("falls back to a generic line without a retry time", () => {
    expect(saveErrorMessage(null, 0)).toBe("Kaydedilemedi · tekrar denenecek");
  });
});
