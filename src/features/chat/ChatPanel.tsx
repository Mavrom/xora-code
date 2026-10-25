import { ChatWelcome } from "./ChatWelcome";
import { Composer } from "./Composer";

/**
 * Phase 2 placeholder: the conversation view, with the composer pinned to the bottom.
 * The shrinkable top spacer matches the composer's resting height, so the welcome block
 * sits on the same optical centre as the editor's empty state beside it (both lift by pb-12).
 */
export function ChatPanel() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
        <div aria-hidden className="shrink basis-33" />
        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <ChatWelcome />
        </div>
      </div>
      <div className="mx-auto w-full max-w-180 px-4 pb-4">
        <Composer />
      </div>
    </div>
  );
}
