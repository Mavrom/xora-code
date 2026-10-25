/**
 * Guards async results against staleness: each `begin(key)` supersedes the previous
 * request for that key, so only the last one started may apply its result.
 */
export function createLatestGate() {
  let seq = 0;
  const latest = new Map<string, number>();

  return {
    begin(key = ""): number {
      seq += 1;
      latest.set(key, seq);
      return seq;
    },
    isLatest(token: number, key = ""): boolean {
      return latest.get(key) === token;
    },
    /** Invalidates everything in flight (e.g. on unmount). */
    cancelAll(): void {
      latest.clear();
    },
  };
}

export type LatestGate = ReturnType<typeof createLatestGate>;
