// The Review panel's diff: the editor's own Monaco diff view. Loaded lazily with Monaco,
// which needs its local setup (workers, theme) whether or not the editor has opened yet.
import "@/features/editor/monaco/setup";
import { useEffect, type ComponentProps } from "react";
import * as monaco from "monaco-editor";
import { DiffView } from "@/features/editor/DiffView";

export default function ReviewDiff(props: ComponentProps<typeof DiffView>) {
  // The panel can open before the editor font has loaded; measure again once it has, or
  // Monaco lays the lines out with the fallback font's widths.
  useEffect(() => {
    void document.fonts.ready.then(() => monaco.editor.remeasureFonts());
  }, []);
  return <DiffView {...props} />;
}
