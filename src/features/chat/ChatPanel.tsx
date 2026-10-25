import { MessagesSquare } from "lucide-react";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Composer } from "./Composer";

/** Phase 2 placeholder: the conversation view, with the composer pinned to the bottom. */
export function ChatPanel() {
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <EmptyState
          icon={MessagesSquare}
          title="Xora ile kodla"
          description="Claude, Codex ve Gemini bağlantısı bir sonraki fazda geliyor."
        />
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <Composer />
      </div>
    </div>
  );
}
