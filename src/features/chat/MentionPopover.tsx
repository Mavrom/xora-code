import { FileRow } from "@/features/files/QuickOpen";
import type { FileHit } from "@/features/files/fileSearch";
import { mentionOptionId } from "./mention";

interface MentionPopoverProps {
  id: string;
  hits: FileHit[];
  active: number;
  loading: boolean;
  onHover: (index: number) => void;
  onPick: (hit: FileHit) => void;
}

/**
 * Files of the folder above the composer while an "@name" is typed. Focus stays in the
 * textarea; rows only respond to the pointer.
 */
export function MentionPopover({
  id,
  hits,
  active,
  loading,
  onHover,
  onPick,
}: MentionPopoverProps) {
  return (
    <div
      id={id}
      role="listbox"
      aria-label="Dosyalar"
      className="absolute inset-x-0 bottom-full z-30 mb-2 max-h-72 overflow-y-auto rounded-xl border border-glass-border bg-glass-strong py-1 shadow-2xl shadow-black/60 backdrop-blur-2xl transition-[opacity,translate] duration-base ease-out-quint starting:translate-y-1 starting:opacity-0"
    >
      <div className="px-3.5 pt-1.5 pb-1 text-3xs font-medium tracking-wide text-fg-subtle uppercase">
        Dosya ekle
      </div>
      {hits.length === 0 ? (
        <p className="px-3.5 py-2 text-xs text-fg-subtle">
          {loading ? "Dosyalar listeleniyor…" : "Eşleşen dosya yok"}
        </p>
      ) : (
        hits.map((hit, i) => (
          <FileRow
            key={hit.path}
            id={mentionOptionId(id, i)}
            hit={hit}
            active={i === active}
            onHover={() => onHover(i)}
            onOpen={() => onPick(hit)}
          />
        ))
      )}
    </div>
  );
}
