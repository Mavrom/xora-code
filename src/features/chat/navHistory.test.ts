import { beforeEach, describe, expect, it } from "vitest";
import { useAgentStore } from "@/features/agents/store";
import { canTravel, installNavHistory, travel, useNavHistory } from "./navHistory";

const open = (id: string | null) => useAgentStore.getState().setActiveSession(id);

describe("navHistory", () => {
  let stop: () => void = () => {};
  beforeEach(() => {
    stop();
    useAgentStore.setState({
      activeSessionId: null,
      sessions: { a: {} as never, b: {} as never },
    });
    useNavHistory.setState({ stack: [null], index: 0 });
    stop = installNavHistory();
  });

  it("goes back and forward through visited conversations", () => {
    open("a");
    open("b");
    travel(-1);
    expect(useAgentStore.getState().activeSessionId).toBe("a");
    travel(-1);
    expect(useAgentStore.getState().activeSessionId).toBeNull();
    expect(canTravel(useNavHistory.getState(), -1)).toBe(false);
    travel(1);
    travel(1);
    expect(useAgentStore.getState().activeSessionId).toBe("b");
  });

  it("drops the forward trail on a new visit", () => {
    open("a");
    open("b");
    travel(-1);
    open(null);
    expect(canTravel(useNavHistory.getState(), 1)).toBe(false);
  });
});
