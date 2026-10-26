import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FolderOpen, X } from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { ipc } from "@/shared/lib/ipc";
import { basename } from "@/shared/lib/path";
import { cn } from "@/shared/ui/cn";
import { imageMime } from "./attachments";
import type { ToolImage } from "./toolView";

/** Object URL for a picture: inline base64 decoded once, or a file read through the backend. */
function useImageUrl(image: ToolImage): string | null | "failed" {
  const [url, setUrl] = useState<string | null | "failed">(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    const show = (blob: Blob) => {
      made = URL.createObjectURL(blob);
      if (alive) setUrl(made);
      else URL.revokeObjectURL(made);
    };
    if (image.kind === "data") {
      void fetch(`data:${image.mimeType};base64,${image.data}`)
        .then((r) => r.blob())
        .then(show, () => alive && setUrl("failed"));
    } else {
      void ipc.readBytes(image.path).then(
        (bytes) => show(new Blob([bytes], { type: imageMime(image.path) ?? "image/png" })),
        () => alive && setUrl("failed"),
      );
    }
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [image]);
  return url;
}

/** Pictures a tool call produced or opened, shown in the conversation; click to enlarge. */
export function ToolImages({ images, inset = true }: { images: ToolImage[]; inset?: boolean }) {
  return (
    <div className={cn("flex flex-wrap gap-2 pt-1 pb-2", inset && "pl-6")}>
      {images.map((image) => (
        <ToolImageTile key={image.key} image={image} />
      ))}
    </div>
  );
}

function ToolImageTile({ image }: { image: ToolImage }) {
  const url = useImageUrl(image);
  const [zoomed, setZoomed] = useState(false);
  const name = image.path ? basename(image.path) : "Görsel";

  // A file that is gone (or never was) just does not show.
  if (url === "failed") return null;
  if (!url) {
    return <div aria-hidden className="h-56 w-80 animate-pulse rounded-xl bg-white/[0.04]" />;
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        title={image.path ?? undefined}
        className="overflow-hidden rounded-xl border border-glass-border shadow-[0_8px_30px_rgb(0_0_0/0.45)] transition-[scale,border-color] duration-base ease-out-quint hover:scale-[1.01] hover:border-white/20"
      >
        <img src={url} alt={name} className="max-h-80 max-w-full object-contain" />
      </button>
      {zoomed && <Lightbox url={url} image={image} onClose={() => setZoomed(false)} />}
    </>
  );
}

function Lightbox({ url, image, onClose }: { url: string; image: ToolImage; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-label="Görsel"
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-10 backdrop-blur-md transition-opacity duration-base starting:opacity-0"
    >
      <img
        src={url}
        alt={image.path ? basename(image.path) : "Görsel"}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-xl object-contain shadow-[0_20px_80px_rgb(0_0_0/0.7)]"
      />
      <div className="absolute top-4 right-4 flex gap-1">
        {image.path && (
          <button
            type="button"
            aria-label="Klasörde göster"
            title={image.path}
            onClick={(e) => {
              e.stopPropagation();
              if (image.path) void revealItemInDir(image.path).catch(() => undefined);
            }}
            className="grid size-9 place-items-center rounded-lg text-fg-muted transition-colors duration-fast hover:bg-white/10 hover:text-fg"
          >
            <FolderOpen size={16} strokeWidth={1.75} aria-hidden />
          </button>
        )}
        <button
          type="button"
          aria-label="Kapat"
          onClick={onClose}
          className="grid size-9 place-items-center rounded-lg text-fg-muted transition-colors duration-fast hover:bg-white/10 hover:text-fg"
        >
          <X size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>,
    document.body,
  );
}
