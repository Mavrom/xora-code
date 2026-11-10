import { create } from "zustand";
import type { Release } from "./releaseCheck";
import { readSaved, writeSaved } from "./saved";

interface UpdateState {
  /** A release newer than the running app, once the check has found one. */
  available: Release | null;
  /** The version whose notice was dismissed. */
  dismissed: string | null;
  setAvailable: (release: Release | null) => void;
  /** Hides this version's notice for good; a later version shows again. */
  dismiss: (version: string) => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  available: null,
  dismissed: readSaved().dismissed,
  setAvailable: (available) => set({ available }),
  dismiss: (version) => {
    writeSaved({ dismissed: version });
    set({ dismissed: version });
  },
}));

/** The release the sidebar notice shows: available and not dismissed. */
export const selectNotice = (s: Pick<UpdateState, "available" | "dismissed">) =>
  s.available && s.available.version !== s.dismissed ? s.available : null;
