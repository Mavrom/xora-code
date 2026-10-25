import {
  Braces,
  Cog,
  File as FileGeneric,
  FileCode,
  FileText,
  Image as ImageIcon,
  Palette,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { extname } from "@/shared/lib/path";

const ICONS: Record<string, LucideIcon> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  json: Braces,
  md: FileText,
  css: Palette,
  rs: Cog,
  toml: Settings2,
  yaml: Settings2,
  yml: Settings2,
  png: ImageIcon,
  jpg: ImageIcon,
  jpeg: ImageIcon,
  svg: ImageIcon,
  gif: ImageIcon,
  webp: ImageIcon,
};

export function FileIcon({ name }: { name: string }) {
  const Icon = ICONS[extname(name)] ?? FileGeneric;
  return <Icon size={14} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden />;
}
