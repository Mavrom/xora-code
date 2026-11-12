// Variant (prototype, for the owner to pick): once a conversation has messages the
// wallpaper steps back, darkening across the whole window, and the readability scrim is no
// longer needed. On the new-chat screen the picture is unchanged.

/** Off: the picture stays as it is behind conversations, with the scrim. */
export const WALLPAPER_STEPS_BACK = false;

/** Share of the picture's light left in a conversation when it steps back. */
export const CONVERSATION_LIGHT = 0.12;

/**
 * Whether the variant is on. DEV builds can try either side without a rebuild:
 * `?wallpaper=fade` turns it on, `?wallpaper=scrim` off.
 */
export function wallpaperStepsBack(search: string = globalThis.location?.search ?? ""): boolean {
  if (import.meta.env.DEV) {
    const choice = new URLSearchParams(search).get("wallpaper");
    if (choice === "fade") return true;
    if (choice === "scrim") return false;
  }
  return WALLPAPER_STEPS_BACK;
}

export const STEPS_BACK = wallpaperStepsBack();
