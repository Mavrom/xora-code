import { Paperclip } from "lucide-react";

/** Shown over the window while files are dragged in. */
export function DropOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-3 z-40 grid place-items-center rounded-2xl border border-dashed border-white/25 bg-black/55 transition-opacity duration-base starting:opacity-0"
    >
      <div className="flex flex-col items-center gap-2 text-fg">
        <span className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/[0.06]">
          <Paperclip size={18} strokeWidth={1.75} />
        </span>
        <p className="text-ui font-medium">Sohbete eklemek için bırak</p>
        <p className="text-xs text-fg-muted">Dosyalar, klasörler ve görseller</p>
      </div>
    </div>
  );
}
