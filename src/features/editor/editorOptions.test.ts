import { describe, expect, it } from "vitest";
import { DEFAULT_EDITOR_SETTINGS } from "./editorSettings";
import { diffOptionsFor, editorOptionsFor } from "./editorOptions";

describe("editor options", () => {
  it("carry the user's font size, wrap and line numbers", () => {
    const options = editorOptionsFor({
      ...DEFAULT_EDITOR_SETTINGS,
      fontSize: 15,
      wordWrap: true,
      lineNumbers: "off",
    });
    expect(options).toMatchObject({ fontSize: 15, wordWrap: "on", lineNumbers: "off" });
  });

  it("make the diff read-only, minimap-free and inline when narrow", () => {
    const options = diffOptionsFor({ ...DEFAULT_EDITOR_SETTINGS, minimap: true, fontSize: 15 });
    expect(options).toMatchObject({
      fontSize: 15,
      readOnly: true,
      originalEditable: false,
      renderSideBySide: true,
      useInlineViewWhenSpaceIsLimited: true,
      hideUnchangedRegions: { enabled: true },
      minimap: { enabled: false },
    });
  });
});
