import { describe, expect, it, vi } from "vitest";
import { createWriteQueue } from "./writeQueue";

/** A send whose calls resolve only when the test says so. */
function controlledSend() {
  const calls: string[] = [];
  const resolvers: Array<() => void> = [];
  const send = vi.fn((data: string) => {
    calls.push(data);
    return new Promise<void>((resolve) => resolvers.push(resolve));
  });
  const settle = async () => {
    resolvers.shift()?.();
    await Promise.resolve();
    await Promise.resolve();
  };
  return { send, calls, settle };
}

describe("createWriteQueue", () => {
  it("keeps one call in flight and coalesces input typed meanwhile", async () => {
    const { send, calls, settle } = controlledSend();
    const queue = createWriteQueue(send);
    queue.push("l");
    queue.push("s");
    queue.push("\r");
    expect(calls).toEqual(["l"]);
    await settle();
    expect(calls).toEqual(["l", "s\r"]);
    await settle();
    queue.push("x");
    expect(calls).toEqual(["l", "s\r", "x"]);
  });

  it("keeps going after a failed call", async () => {
    const onError = vi.fn();
    const send = vi.fn().mockRejectedValueOnce(new Error("gone")).mockResolvedValue(undefined);
    const queue = createWriteQueue(send, onError);
    queue.push("a");
    queue.push("b");
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
    expect(onError).toHaveBeenCalledOnce();
  });

  it("ignores empty input and anything after dispose", async () => {
    const { send, calls, settle } = controlledSend();
    const queue = createWriteQueue(send);
    queue.push("");
    expect(send).not.toHaveBeenCalled();
    queue.push("a");
    queue.push("b");
    queue.dispose();
    await settle();
    queue.push("c");
    expect(calls).toEqual(["a"]);
  });
});
