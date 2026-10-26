/** The parts of a keyboard event that tell whether an IME composition is in progress. */
export interface ImeKeyLike {
  /** True while an IME composition is active (e.g. accented or CJK input). */
  isComposing?: boolean;
  /** Legacy `keyCode`; WebKit reports 229 for the Enter that commits an IME candidate. */
  keyCode?: number;
}

/** IME composition in progress, including WebKit's `keyCode` 229 while `isComposing` is false. */
export function isImeComposing(event: ImeKeyLike): boolean {
  return event.isComposing === true || event.keyCode === 229;
}
