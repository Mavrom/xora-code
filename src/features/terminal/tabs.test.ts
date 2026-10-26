import { beforeEach, describe, expect, it } from "vitest";
import { activeAfterClose, cycleTab, nextSeq, tabLabels, type TerminalTab } from "./tabs";
import { useTerminalStore } from "./store";

const tab = (key: number, seq = key, shell: string | null = "pwsh"): TerminalTab => ({
  key,
  seq,
  shell,
  status: "running",
});

describe("nextSeq", () => {
  it("starts at one and fills gaps", () => {
    expect(nextSeq([])).toBe(1);
    expect(nextSeq([tab(1), tab(2)])).toBe(3);
    expect(nextSeq([tab(1, 1), tab(3, 3)])).toBe(2);
  });
});

describe("activeAfterClose", () => {
  const tabs = [tab(1), tab(2), tab(3)];

  it("keeps the active tab when another one closes", () => {
    expect(activeAfterClose(tabs, 3, 1)).toBe(1);
  });

  it("moves right, then left, then to none", () => {
    expect(activeAfterClose(tabs, 2, 2)).toBe(3);
    expect(activeAfterClose(tabs, 3, 3)).toBe(2);
    expect(activeAfterClose([tab(1)], 1, 1)).toBeNull();
  });

  it("ignores unknown keys", () => {
    expect(activeAfterClose(tabs, 9, 9)).toBe(9);
  });
});

describe("tabLabels", () => {
  it("adds numbers only to shared names", () => {
    const labels = tabLabels([tab(1, 1), tab(2, 2), tab(3, 1, "bash"), tab(4, 3, null)]);
    expect([...labels.values()]).toEqual(["pwsh 1", "pwsh 2", "bash", "Terminal"]);
  });
});

describe("cycleTab", () => {
  const tabs = [tab(1), tab(2), tab(3)];

  it("wraps in both directions", () => {
    expect(cycleTab(tabs, 3, 1)).toBe(1);
    expect(cycleTab(tabs, 1, -1)).toBe(3);
    expect(cycleTab(tabs, 2, 1)).toBe(3);
  });

  it("handles no tabs and an unknown active key", () => {
    expect(cycleTab([], null, 1)).toBeNull();
    expect(cycleTab(tabs, null, 1)).toBe(2);
  });
});

describe("useTerminalStore", () => {
  beforeEach(() => useTerminalStore.setState({ tabs: [], activeKey: null, open: false }));

  it("adds, activates, updates and removes tabs", () => {
    const { addTab } = useTerminalStore.getState();
    const a = addTab();
    const b = addTab();
    let s = useTerminalStore.getState();
    expect(s.activeKey).toBe(b);
    expect(s.tabs.map((t) => t.seq)).toEqual([1, 2]);
    expect(s.tabs[0].status).toBe("starting");

    s.update(a, { shell: "pwsh", status: "running" });
    s.setActive(a);
    s = useTerminalStore.getState();
    expect(s.tabs[0]).toMatchObject({ shell: "pwsh", status: "running" });
    expect(s.activeKey).toBe(a);

    s.removeTab(a);
    s = useTerminalStore.getState();
    expect(s.tabs.map((t) => t.key)).toEqual([b]);
    expect(s.activeKey).toBe(b);
  });

  it("ignores activating a closed tab", () => {
    const { addTab, setActive } = useTerminalStore.getState();
    const a = addTab();
    setActive(a + 100);
    expect(useTerminalStore.getState().activeKey).toBe(a);
  });
});
