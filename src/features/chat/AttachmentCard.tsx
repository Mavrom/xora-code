import { FileText, Folder, X } from "lucide-react";
import { dataUrl, type Attachment } from "./attachments";
import { t } from "@/shared/i18n";

/** One attachment above the field: a thumbnail for pictures, a name card for the rest. */
export function AttachmentCard({
  attachment: a,
  onRemove,
}: {
  attachment: Attachment;
  onRemove?: (id: string) => void;
}) {
  const remove = onRemove && (
    <button
      type="button"
      aria-label={t("Remove attachment {name}", { name: a.name })}
      title={t("Remove")}
      onClick={() => onRemove(a.id)}
      className="absolute -top-1.5 -right-1.5 grid size-4.5 place-items-center rounded-full border border-white/10 bg-hover text-fg-muted opacity-0 shadow-md transition-[opacity,color] duration-fast group-hover:opacity-100 group-focus-within:opacity-100 hover:text-fg"
    >
      <X size={10} strokeWidth={2.25} aria-hidden />
    </button>
  );
  if (a.kind === "image" && a.data && a.mimeType) {
    return (
      <span className="group relative block" title={a.name}>
        <img
          src={dataUrl(a.mimeType, a.data)}
          alt={a.name}
          className="size-14 rounded-lg border border-white/10 object-cover"
        />
        {remove}
      </span>
    );
  }
  const Icon = a.kind === "folder" ? Folder : FileText;
  return (
    <span
      title={a.path ?? a.name}
      className="group relative flex h-9 max-w-56 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] pr-3 pl-2.5 text-xs text-fg-muted"
    >
      <Icon size={14} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-subtle" />
      <span className="truncate">{a.name}</span>
      {remove}
    </span>
  );
}
