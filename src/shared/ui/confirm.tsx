import { createRoot } from "react-dom/client";
import { ConfirmDialog, type ConfirmChoice, type ConfirmOptions } from "./ConfirmDialog";

export type { ConfirmChoice, ConfirmOptions };

let pending = false;

/**
 * Shows the in-app confirm dialog (Kaydet / Kaydetme / İptal) and resolves with the user's
 * choice. Only one is shown at a time: a call while another is open resolves to "cancel"
 * right away. Outside a DOM (tests) it also resolves to "cancel".
 */
export function confirmDialog(options: ConfirmOptions): Promise<ConfirmChoice> {
  if (pending || typeof document === "undefined") return Promise.resolve("cancel");
  pending = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  return new Promise<ConfirmChoice>((resolve) => {
    const onChoose = (choice: ConfirmChoice) => {
      // Unmount (outside React's event dispatch) before resolving, so focus is back where
      // it was before the caller acts on the choice.
      queueMicrotask(() => {
        root.unmount();
        host.remove();
        pending = false;
        resolve(choice);
      });
    };
    root.render(<ConfirmDialog {...options} onChoose={onChoose} />);
  });
}
