import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCloseGuardRegistry } from "./closeGuards";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Tracks whether `promise` has settled yet. */
function track(promise: Promise<void>) {
  const state = { done: false };
  void promise.then(() => (state.done = true));
  return state;
}

describe("close guard registry", () => {
  it("resolves right away with no guards", async () => {
    const registry = createCloseGuardRegistry(3_000);
    const state = track(registry.run());
    await vi.advanceTimersByTimeAsync(0);
    expect(state.done).toBe(true);
  });

  it("starts every guard synchronously and waits for all of them", async () => {
    const registry = createCloseGuardRegistry(3_000);
    const order: string[] = [];
    registry.register(() => {
      order.push("sync");
    });
    registry.register(
      () =>
        new Promise<void>((resolve) => {
          order.push("slow:start");
          setTimeout(() => {
            order.push("slow:end");
            resolve();
          }, 500);
        }),
    );
    const state = track(registry.run());
    expect(order).toEqual(["sync", "slow:start"]);
    await vi.advanceTimersByTimeAsync(499);
    expect(state.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(state.done).toBe(true);
    expect(order).toContain("slow:end");
  });

  it("gives up on a hung guard after the timeout", async () => {
    const registry = createCloseGuardRegistry(3_000);
    registry.register(() => new Promise<void>(() => {}));
    const state = track(registry.run());
    await vi.advanceTimersByTimeAsync(2_999);
    expect(state.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(state.done).toBe(true);
  });

  it("a throwing or rejecting guard is reported and does not stop the others", async () => {
    const onError = vi.fn();
    const registry = createCloseGuardRegistry(3_000, onError);
    const ran = vi.fn();
    registry.register(() => {
      throw new Error("sync boom");
    });
    registry.register(() => Promise.reject(new Error("async boom")));
    registry.register(ran);
    await expect(registry.run()).resolves.toBeUndefined();
    expect(ran).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("unregister removes only that guard and is idempotent", async () => {
    const registry = createCloseGuardRegistry(3_000);
    const a = vi.fn();
    const b = vi.fn();
    const offA = registry.register(a);
    registry.register(b);
    offA();
    offA();
    await registry.run();
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
  });

  it("the same function registered twice runs twice until each is removed", async () => {
    const registry = createCloseGuardRegistry(3_000);
    const guard = vi.fn();
    const off1 = registry.register(guard);
    registry.register(guard);
    off1();
    await registry.run();
    expect(guard).toHaveBeenCalledOnce();
  });
});
