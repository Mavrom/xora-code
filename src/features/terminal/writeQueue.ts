export interface WriteQueue {
  /** Queues input for the shell. */
  push: (data: string) => void;
  /** Drops pending input; later pushes are ignored. */
  dispose: () => void;
}

/**
 * Sends terminal input strictly in order with at most one IPC call in flight. Async
 * commands may run concurrently on the Rust side, so fast typing could otherwise
 * arrive out of order; input typed while a call is in flight is coalesced into the next.
 */
export function createWriteQueue(
  send: (data: string) => Promise<unknown>,
  onError: (err: unknown) => void = (err) => console.error("terminal write failed", err),
): WriteQueue {
  let pending = "";
  let busy = false;
  let disposed = false;

  const flush = async () => {
    busy = true;
    while (pending && !disposed) {
      const chunk = pending;
      pending = "";
      try {
        await send(chunk);
      } catch (err) {
        onError(err);
      }
    }
    busy = false;
  };

  return {
    push(data) {
      if (disposed || !data) return;
      pending += data;
      if (!busy) void flush();
    },
    dispose() {
      disposed = true;
      pending = "";
    },
  };
}
