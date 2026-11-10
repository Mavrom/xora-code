import { describe, expect, it, vi } from "vitest";
import { beginCapture, installCaptureGuard, isCapturing } from "./captureGuard";

describe("capture guard", () => {
  let listener: ((e: KeyboardEvent) => void) | undefined;
  const target = {
    addEventListener: vi.fn((_type: string, fn: (e: KeyboardEvent) => void, capture: boolean) => {
      expect(capture).toBe(true);
      listener = fn;
    }),
  } as unknown as Pick<Window, "addEventListener">;

  const fire = (key: string, mods: Partial<KeyboardEvent> = {}) => {
    const e = {
      key,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      ...mods,
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    };
    listener?.(e as unknown as KeyboardEvent);
    return e;
  };

  it("hands every key to the recorder and stops it reaching the app's shortcuts", () => {
    installCaptureGuard(target);
    installCaptureGuard(target);
    expect(target.addEventListener).toHaveBeenCalledOnce();

    expect(fire("b", { ctrlKey: true }).stopImmediatePropagation).not.toHaveBeenCalled();

    const seen: string[] = [];
    const end = beginCapture((e) => seen.push(e.key));
    expect(isCapturing()).toBe(true);
    const ctrlB = fire("b", { ctrlKey: true });
    expect(ctrlB.preventDefault).toHaveBeenCalled();
    expect(ctrlB.stopImmediatePropagation).toHaveBeenCalled();
    // Tab still moves focus.
    const tab = fire("Tab");
    expect(tab.preventDefault).not.toHaveBeenCalled();
    expect(tab.stopImmediatePropagation).toHaveBeenCalled();
    expect(seen).toEqual(["b", "Tab"]);

    end();
    expect(isCapturing()).toBe(false);
    expect(fire("b", { ctrlKey: true }).stopImmediatePropagation).not.toHaveBeenCalled();
  });

  it("ignores a stale end from an earlier recorder", () => {
    const endFirst = beginCapture(() => undefined);
    const endSecond = beginCapture(() => undefined);
    endFirst();
    expect(isCapturing()).toBe(true);
    endSecond();
    expect(isCapturing()).toBe(false);
  });
});
