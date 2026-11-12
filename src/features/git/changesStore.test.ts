import { beforeEach, describe, expect, it, vi } from "vitest";
import { noticeUnderBranch, useChangesStore } from "./changesStore";
import { gitIpc, type GitStatus } from "./ipc";

vi.mock("./ipc", () => ({
  gitIpc: {
    status: vi.fn(),
    stage: vi.fn(),
    unstage: vi.fn(),
    discard: vi.fn(),
    diff: vi.fn(),
    commit: vi.fn(),
    push: vi.fn(),
    pull: vi.fn(),
  },
}));

const status = vi.mocked(gitIpc.status);
const s = () => useChangesStore.getState();

const clean = (root: string): GitStatus => ({
  root,
  branch: "main",
  head: "abc1234",
  upstream: null,
  ahead: 0,
  behind: 0,
  entries: [],
  truncated: false,
});

/** A promise resolved from the test, to hold a call open. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  status.mockImplementation((dir) => Promise.resolve(clean(dir)));
  useChangesStore.setState({
    dir: null,
    status: null,
    problem: "no_folder",
    error: null,
    loading: false,
    busy: null,
    notice: null,
    version: 0,
  });
});

describe("changes store", () => {
  it("loads the status of the checkout it is pointed at", async () => {
    await s().setDir("C:/repo");
    expect(status).toHaveBeenCalledWith("C:/repo");
    expect(s().status?.root).toBe("C:/repo");
    expect(s().problem).toBeNull();
    expect(s().version).toBeGreaterThan(0);
  });

  it("tells a folder outside git from other failures", async () => {
    status.mockRejectedValueOnce("[not_repo] not a git repository");
    await s().setDir("C:/plain");
    expect(s().problem).toBe("not_repo");

    status.mockRejectedValueOnce("[no_git] git could not be started");
    await s().refresh();
    expect(s().problem).toBe("error");
    expect(s().error).toBe("Git bulunamadı. Değişiklikler görünümü için Git'i kur.");
  });

  it("shows no folder when there is none", async () => {
    await s().setDir("C:/repo");
    await s().setDir(null);
    expect(s().problem).toBe("no_folder");
    expect(s().status).toBeNull();
  });

  it("collapses overlapping refreshes into one follow-up", async () => {
    useChangesStore.setState({ dir: "C:/repo" });
    const first = deferred<GitStatus>();
    status.mockReturnValueOnce(first.promise);
    const running = s().refresh();
    void s().refresh();
    void s().refresh();
    first.resolve(clean("C:/repo"));
    await running;
    expect(status).toHaveBeenCalledTimes(2);
  });

  it("drops a status that arrives after switching checkouts", async () => {
    useChangesStore.setState({ dir: "C:/a" });
    const slow = deferred<GitStatus>();
    status.mockReturnValueOnce(slow.promise);
    const running = s().refresh();
    void s().setDir("C:/b");
    slow.resolve(clean("C:/a"));
    await running;
    expect(s().dir).toBe("C:/b");
    expect(s().status?.root).toBe("C:/b");
  });

  it("reports a failed action, then refreshes", async () => {
    useChangesStore.setState({ dir: "C:/repo" });
    vi.mocked(gitIpc.push).mockRejectedValueOnce("[no_remote] the repository has no remote");
    expect(await s().push()).toBe(false);
    expect(s().notice).toEqual({
      text: "Bu deponun push edilecek bir remote'u yok.",
      error: true,
    });
    expect(s().busy).toBeNull();
    expect(status).toHaveBeenCalledWith("C:/repo");
  });

  it("runs one action at a time and confirms a commit", async () => {
    useChangesStore.setState({ dir: "C:/repo" });
    const commit = deferred<string>();
    vi.mocked(gitIpc.commit).mockReturnValueOnce(commit.promise);
    const running = s().commit("Fix it");
    expect(await s().stage(["a.ts"])).toBe(false);
    expect(gitIpc.stage).not.toHaveBeenCalled();
    commit.resolve("abc1234");
    expect(await running).toBe(true);
    expect(s().notice).toEqual({ text: "abc1234 commit edildi.", error: false });
  });
});

describe("the notice line", () => {
  it("survives a refresh in a folder git cannot read, and moves under the header there", async () => {
    status.mockRejectedValue("[not_repo] not a git repository");
    await s().setDir("C:/plain");
    s().setNotice({ text: "revert failed", error: true });
    await s().refresh();
    expect(s().problem).toBe("not_repo");
    expect(s().notice).toEqual({ text: "revert failed", error: true });
    expect(noticeUnderBranch(s())).toBe(false);
  });

  it("sits under the branch line once the status is loaded", async () => {
    await s().setDir("C:/repo");
    expect(noticeUnderBranch(s())).toBe(true);
    expect(noticeUnderBranch({ status: null, problem: "no_folder" })).toBe(false);
  });
});
