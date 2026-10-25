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
  add: (text: string) => void;
  update: (id: string, text: string) => void;
  togglePin: (id: string) => void;
  toggleDone: (id: string) => void;
  remove: (id: string) => void;
}

// --- Debounced persistence ---------------------------------------------------
// One save in flight at a time; a change made meanwhile triggers exactly one
// follow-up save of whatever the list is by then (last write wins).

let timer: ReturnType<typeof setTimeout> | undefined;
let saving = false;
let saveAgain = false;

function scheduleSave() {
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), SAVE_DELAY_MS);
}

async function flush() {
  timer = undefined;
  // Never write before a successful load: that would replace the user's file.
  if (useInboxStore.getState().status !== "ready") return;
  if (saving) {
    saveAgain = true;
    return;
  }
  saving = true;
  try {
    await ipc.notesSave(useInboxStore.getState().notes);
    useInboxStore.setState({ error: null });
  } catch (err) {
    // Keep the notes in memory; the next mutation schedules a retry.
    useInboxStore.setState({ error: String(err) });
  } finally {
    saving = false;
    if (saveAgain) {
      saveAgain = false;
      void flush();
    }
  }
}

// --- Store -------------------------------------------------------------------

export const useInboxStore = create<InboxState>((set, get) => {
  /** Applies `change` to the list when ready; saves only if something changed. */
  const mutate = (change: (notes: Note[]) => Note[]) => {
    if (get().status !== "ready") return;
    const prev = get().notes;
    const next = change(prev);
    if (next === prev) return;
    set({ notes: next });
    scheduleSave();
  };

  /** Patches one note and bumps its `updatedAt`; unknown ids leave the list as is. */
  const patch = (id: string, fn: (n: Note) => Partial<Note> | null) =>
    mutate((notes) => {
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
      if (!trimmed) return;
      const now = Date.now();
      const note: Note = {
        id: crypto.randomUUID(),
        text: trimmed,
        pinned: false,
        done: false,
        createdAt: now,
        updatedAt: now,
      };
      mutate((notes) => [note, ...notes]);
    },

    update: (id, text) => {
      const trimmed = text.trim();
      patch(id, (n) => (trimmed && trimmed !== n.text ? { text: trimmed } : null));
    },

    togglePin: (id) => patch(id, (n) => ({ pinned: !n.pinned })),

    toggleDone: (id) => patch(id, (n) => ({ done: !n.done })),

    remove: (id) =>
      mutate((notes) =>
        notes.some((n) => n.id === id) ? notes.filter((n) => n.id !== id) : notes,
      ),
  };
});
