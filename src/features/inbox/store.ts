import { create } from "zustand";
import { ipc, type Note } from "@/shared/lib/ipc";

export const SAVE_DELAY_MS = 300;

type Status = "idle" | "loading" | "ready" | "error";

interface InboxState {
  notes: Note[];
  status: Status;
  /** Load failure (status `error`) or the last save failure (status `ready`). */
  error: string | null;
  load: () => Promise<void>;
  /** Adds a note; `false` when nothing was added (empty text, or not loaded yet). */
  add: (text: string) => boolean;
  update: (id: string, text: string) => void;
  togglePin: (id: string) => void;
  toggleDone: (id: string) => void;
  remove: (id: string) => void;
  /** Puts a removed note back exactly as it was (undo). */
  restore: (note: Note) => void;
  /** The most recently removed note, offered for undo until dismissed. */
  lastRemoved: Note | null;
  dismissRemoved: () => void;
}

// --- Debounced persistence ---------------------------------------------------
// One save in flight at a time; changes made meanwhile are picked up by the
// same save loop right after (last write wins). A failed save is retried with
// backoff while there are unsaved changes.

/** Delays between automatic retries after a failed save; the last one repeats. */
export const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000];

let timer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryAttempt = 0;
let inflight: Promise<void> | null = null;
/** True while the in-memory list has changes not yet written to disk. */
let dirty = false;

const isReady = () => useInboxStore.getState().status === "ready";

function scheduleSave() {
  dirty = true;
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), SAVE_DELAY_MS);
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
  retryAttempt += 1;
  retryTimer = setTimeout(() => void flush(), delay);
}

/** Saves until nothing is dirty; stops (and schedules a retry) on the first failure. */
async function saveLoop() {
  while (dirty && isReady()) {
    dirty = false;
    try {
      await ipc.notesSave(useInboxStore.getState().notes);
    } catch (err) {
      // Keep the notes in memory and try again later.
      dirty = true;
      useInboxStore.setState({ error: String(err) });
      scheduleRetry();
      return;
    }
    clearTimeout(retryTimer);
    retryTimer = undefined;
    retryAttempt = 0;
    useInboxStore.setState({ error: null });
  }
}

/** Starts a save (or joins the running one). Never rejects. */
function flush(): Promise<void> {
  clearTimeout(timer);
  timer = undefined;
  // Never write before a successful load: that would replace the user's file.
  if (!isReady()) return Promise.resolve();
  if (!inflight) {
    if (!dirty) return Promise.resolve();
    const run = saveLoop();
    inflight = run;
    // Registered before any awaiter, so `inflight` is cleared first.
    void run.finally(() => {
      if (inflight === run) inflight = null;
    });
  }
  return inflight;
}

/**
 * Writes pending changes now, skipping the debounce (e.g. before the window
 * closes). Waits for a save already in flight and gives a failed one a last
 * try. Never rejects.
 */
export async function flushNow(): Promise<void> {
  clearTimeout(timer);
  timer = undefined;
  if (!isReady()) return;
  if (inflight) await inflight;
  if (dirty) await flush();
}

// --- Store -------------------------------------------------------------------

export const useInboxStore = create<InboxState>((set, get) => {
  /** Applies `change` to the list when ready; saves only if something changed. */
  const mutate = (change: (notes: Note[]) => Note[]): boolean => {
    if (get().status !== "ready") return false;
    const prev = get().notes;
    const next = change(prev);
    if (next === prev) return false;
    set({ notes: next });
    scheduleSave();
    return true;
  };

  /** Patches one note and bumps its `updatedAt`; unknown ids leave the list as is. */
  const patch = (id: string, fn: (n: Note) => Partial<Note> | null) =>
    void mutate((notes) => {
      const index = notes.findIndex((n) => n.id === id);
      const changes = index === -1 ? null : fn(notes[index]);
      if (!changes) return notes;
      const next = [...notes];
      next[index] = { ...notes[index], ...changes, updatedAt: Date.now() };
      return next;
    });

  return {
    notes: [],
    status: "idle",
    error: null,

    load: async () => {
      // Loading twice (or after edits) could clobber unsaved changes.
      const { status } = get();
      if (status === "loading" || status === "ready") return;
      set({ status: "loading", error: null });
      try {
        const notes = await ipc.notesList();
        set({ notes, status: "ready", error: null });
      } catch (err) {
        set({ status: "error", error: String(err) });
      }
    },

    add: (text) => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      const now = Date.now();
      const note: Note = {
        id: crypto.randomUUID(),
        text: trimmed,
        pinned: false,
        done: false,
        createdAt: now,
        updatedAt: now,
      };
      return mutate((notes) => [note, ...notes]);
    },

    update: (id, text) => {
      const trimmed = text.trim();
      patch(id, (n) => (trimmed && trimmed !== n.text ? { text: trimmed } : null));
    },

    togglePin: (id) => patch(id, (n) => ({ pinned: !n.pinned })),

    toggleDone: (id) => patch(id, (n) => ({ done: !n.done })),

    remove: (id) => {
      if (get().status !== "ready") return;
      const removed = get().notes.find((n) => n.id === id);
      if (!removed) return;
      mutate((notes) => notes.filter((n) => n.id !== id));
      set({ lastRemoved: removed });
    },

    restore: (note) => {
      mutate((notes) => (notes.some((n) => n.id === note.id) ? notes : [...notes, note]));
      if (get().lastRemoved?.id === note.id) set({ lastRemoved: null });
    },

    lastRemoved: null,
    dismissRemoved: () => set({ lastRemoved: null }),
  };
});
