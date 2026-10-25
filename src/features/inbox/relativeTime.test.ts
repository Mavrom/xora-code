import { describe, expect, it } from "vitest";
import { relativeTime } from "./relativeTime";

const MIN = 60_000;
const HOUR = 60 * MIN;
// 25 Oct 2026, 15:00 local time.
const now = new Date(2026, 9, 25, 15, 0).getTime();

describe("relativeTime", () => {
  it("says 'şimdi' within the first minute (and for clock skew)", () => {
    expect(relativeTime(now, now)).toBe("şimdi");
    expect(relativeTime(now - 59_000, now)).toBe("şimdi");
    expect(relativeTime(now + 5_000, now)).toBe("şimdi");
  });

  it("uses compact minutes and hours", () => {
    expect(relativeTime(now - 5 * MIN, now)).toBe("5 dk");
    expect(relativeTime(now - 59 * MIN, now)).toBe("59 dk");
    expect(relativeTime(now - 2 * HOUR, now)).toBe("2 sa");
  });

  it("says 'dün' for the previous calendar day", () => {
    expect(relativeTime(new Date(2026, 9, 24, 9, 0).getTime(), now)).toBe("dün");
  });

  it("shows minutes across midnight before falling back to 'dün'", () => {
    const justAfterMidnight = new Date(2026, 9, 25, 0, 10).getTime();
    expect(relativeTime(new Date(2026, 9, 24, 23, 50).getTime(), justAfterMidnight)).toBe("20 dk");
  });

  it("shows a short date for older notes, with the year when it differs", () => {
    expect(relativeTime(new Date(2026, 9, 12, 9, 0).getTime(), now)).toBe("12 Eki");
    expect(relativeTime(new Date(2025, 0, 3, 9, 0).getTime(), now)).toBe("3 Oca 2025");
  });
});
