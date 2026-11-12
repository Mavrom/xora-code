// DEV `?fixture=` data for the git views: a small working tree with a few changes, and an
// in-memory stand-in for `gitIpc` (and the file read behind a diff's disk side), so the
// Changes views show realistic rows in a plain browser. Loaded only by `fixtureMode.ts`.
import type { GitDiff, GitRevision, GitStatus, StatusEntry } from "./ipc";

/** The fixture repository root as git spells it (forward slashes). */
export const FIXTURE_GIT_ROOT = "C:/Users/dev/projects/xora-demo";

interface FixtureFile {
  head: string | null;
  index: string | null;
  disk: string | null;
}

const RELATIVE_OLD = `export function relativeTime(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  return \`\${minutes} dk önce\`;
}
`;
const RELATIVE_NEW = `export function relativeTime(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "şimdi";
  if (minutes < 60) return \`\${minutes} dk önce\`;
  return \`\${Math.round(minutes / 60)} sa önce\`;
}
`;
const TEST_OLD = `import { expect, it } from "vitest";
import { relativeTime } from "./relativeTime";

it("shows minutes", () => {
  expect(relativeTime(5 * 60_000)).toBe("5 dk önce");
});
`;
const TEST_NEW = `import { expect, it } from "vitest";
import { relativeTime } from "./relativeTime";

it("shows minutes", () => {
  expect(relativeTime(5 * 60_000)).toBe("5 dk önce");
});

it("says now under a minute and hours past one", () => {
  expect(relativeTime(10_000)).toBe("şimdi");
  expect(relativeTime(3 * 60 * 60_000)).toBe("3 sa önce");
});
`;
const README_OLD = `# xora-demo

A small demo project.
`;
const README_NEW = `# xora-demo

A small demo project for trying Xora Code.

## Setup

npm ci
`;
const NOTES = `- relativeTime: hours and "now" done
- next: days
`;

const files: Record<string, FixtureFile> = {
  "src/features/inbox/relativeTime.ts": {
    head: RELATIVE_OLD,
    index: RELATIVE_OLD,
    disk: RELATIVE_NEW,
  },
  "src/features/inbox/relativeTime.test.ts": { head: TEST_OLD, index: TEST_OLD, disk: TEST_NEW },
  "README.md": { head: README_OLD, index: README_NEW, disk: README_NEW },
  "docs/notes.md": { head: null, index: null, disk: NOTES },
};

const entry = (path: string, extra: Partial<StatusEntry>): StatusEntry => ({
  path,
  origPath: null,
  staged: null,
  unstaged: null,
  untracked: false,
  conflicted: false,
  ...extra,
});

let entries: StatusEntry[] = [
  entry("README.md", { staged: "modified" }),
  entry("src/features/inbox/relativeTime.ts", { unstaged: "modified" }),
  entry("src/features/inbox/relativeTime.test.ts", { unstaged: "modified" }),
  entry("docs/notes.md", { untracked: true }),
];

const status = (): GitStatus => ({
  root: FIXTURE_GIT_ROOT,
  branch: "main",
  head: "2e25d96",
  upstream: "origin/main",
  ahead: 1,
  behind: 0,
  entries: structuredClone(entries),
  truncated: false,
});

/** A whole-file unified diff (one hunk); enough for the panel's inline preview. */
function unified(path: string, before: string | null, after: string | null): string {
  const a = before ? before.replace(/\n$/, "").split("\n") : [];
  const b = after ? after.replace(/\n$/, "").split("\n") : [];
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  const lines = [
    ...a.slice(0, start).map((l) => ` ${l}`),
    ...a.slice(start).map((l) => `-${l}`),
    ...b.slice(start).map((l) => `+${l}`),
  ];
  return [
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -1,${a.length} +1,${b.length} @@`,
    ...lines,
    "",
  ].join("\n");
}

/** The repository-relative path of an absolute fixture path, or null outside it. */
function relative(path: string): string | null {
  const norm = path.replace(/\\/g, "/");
  const root = `${FIXTURE_GIT_ROOT}/`;
  return norm.toLowerCase().startsWith(root.toLowerCase()) ? norm.slice(root.length) : null;
}

/** Replacements for `gitIpc`'s methods, over the in-memory tree above. */
export const fixtureGitIpc = {
  status: async (): Promise<GitStatus> => status(),
  stage: async (_dir: string, paths: string[]) => {
    entries = entries.map((e) =>
      paths.includes(e.path)
        ? {
            ...e,
            staged: e.unstaged ?? (e.untracked ? "added" : e.staged),
            unstaged: null,
            untracked: false,
          }
        : e,
    );
  },
  unstage: async (_dir: string, paths: string[]) => {
    entries = entries.map((e) =>
      paths.includes(e.path) ? { ...e, unstaged: e.staged, staged: null } : e,
    );
  },
  discard: async (_dir: string, paths: string[]) => {
    entries = entries.filter((e) => !paths.includes(e.path) || e.staged !== null);
  },
  diff: async (_dir: string, path: string, staged: boolean): Promise<GitDiff> => {
    const f = files[path];
    if (!f) return { text: "", truncated: false };
    const text = staged ? unified(path, f.head, f.index) : unified(path, f.index, f.disk);
    return { text, truncated: false };
  },
  show: async (_dir: string, path: string, rev: GitRevision): Promise<string | null> =>
    (rev === "head" ? files[path]?.head : files[path]?.index) ?? null,
  commit: async () => "a1b2c3d",
  push: async () => {},
  pull: async () => {},
};

/** Stand-in for `ipc.readFile` on the fixture tree; other paths fail like a missing file. */
export async function fixtureReadFile(path: string): Promise<string> {
  const rel = relative(path);
  const disk = rel ? files[rel]?.disk : null;
  if (disk == null) throw `[not_found] ${path}`;
  return disk;
}
