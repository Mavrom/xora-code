import { describe, expect, it } from "vitest";
import { displayVersion, isNewer, parseVersion } from "./version";

describe("parseVersion", () => {
  it("reads major.minor.patch with or without a leading v", () => {
    expect(parseVersion("v0.2.0")).toEqual({ major: 0, minor: 2, patch: 0, pre: false });
    expect(parseVersion("1.10.3")).toEqual({ major: 1, minor: 10, patch: 3, pre: false });
    expect(parseVersion("1.0.0-beta.1+build.5")).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      pre: true,
    });
  });

  it("rejects anything else", () => {
    for (const bad of ["", "v", "1.2", "1.2.3.4", "01.2.3", "1.2.x", "latest", "V1.2.3", "1.2.3-"])
      expect(parseVersion(bad)).toBeNull();
  });
});

describe("isNewer", () => {
  it("compares numerically, part by part", () => {
    expect(isNewer("v0.2.0", "0.1.0")).toBe(true);
    expect(isNewer("v0.10.0", "0.9.9")).toBe(true);
    expect(isNewer("v1.0.0", "0.99.99")).toBe(true);
    expect(isNewer("v0.1.1", "0.1.0")).toBe(true);
    expect(isNewer("v0.1.0", "0.1.0")).toBe(false);
    expect(isNewer("v0.0.9", "0.1.0")).toBe(false);
    expect(isNewer("v0.1.0", "1.0.0")).toBe(false);
  });

  it("counts a prerelease only when its numbers are higher", () => {
    expect(isNewer("v0.2.0-beta.1", "0.1.0")).toBe(true);
    expect(isNewer("v0.1.0-beta.1", "0.1.0")).toBe(false);
    expect(isNewer("v0.1.0-rc.2", "0.1.0-rc.1")).toBe(false);
    expect(isNewer("v0.1.0", "0.1.0-rc.1")).toBe(true);
  });

  it("treats malformed versions as not newer", () => {
    expect(isNewer("nightly", "0.1.0")).toBe(false);
    expect(isNewer("v9.9", "0.1.0")).toBe(false);
    expect(isNewer("v0.2.0", "")).toBe(false);
  });
});

describe("displayVersion", () => {
  it("drops the leading v", () => {
    expect(displayVersion("v0.2.0")).toBe("0.2.0");
    expect(displayVersion("0.2.0")).toBe("0.2.0");
  });
});
