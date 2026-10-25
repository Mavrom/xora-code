import { describe, expect, it } from "vitest";
import { createLatestGate } from "./latestGate";

describe("createLatestGate", () => {
  it("only the most recent request for a key is current", () => {
    const gate = createLatestGate();
    const first = gate.begin();
    const second = gate.begin();
    expect(gate.isLatest(first)).toBe(false);
    expect(gate.isLatest(second)).toBe(true);
  });

  it("tracks keys independently", () => {
    const gate = createLatestGate();
    const a = gate.begin("/a");
    const b = gate.begin("/b");
    expect(gate.isLatest(a, "/a")).toBe(true);
    expect(gate.isLatest(b, "/b")).toBe(true);
    expect(gate.isLatest(a, "/b")).toBe(false);
  });

  it("lets the last of out-of-order async results win", async () => {
    const gate = createLatestGate();
    const applied: string[] = [];
    const request = (value: string, ms: number) => {
      const token = gate.begin();
      return new Promise<void>((resolve) =>
        setTimeout(() => {
          if (gate.isLatest(token)) applied.push(value);
          resolve();
        }, ms),
      );
    };
    await Promise.all([request("slow", 20), request("fast", 1)]);
    expect(applied).toEqual(["fast"]);
  });

  it("invalidates every pending request after cancelAll", () => {
    const gate = createLatestGate();
    const a = gate.begin("/a");
    const b = gate.begin();
    gate.cancelAll();
    expect(gate.isLatest(a, "/a")).toBe(false);
    expect(gate.isLatest(b)).toBe(false);
  });
});
