/** Codes the Rust fs commands prefix their messages with (`[code] OS text`). */
export type FsErrorCode =
  "not_found" | "permission_denied" | "binary" | "too_large" | "is_dir" | "unknown";

const MESSAGES: Record<Exclude<FsErrorCode, "unknown">, string> = {
  not_found: "Dosya bulunamadı; silinmiş ya da taşınmış olabilir.",
  permission_denied: "Erişim izni yok.",
  binary: "Metin dosyası değil; ikili dosyalar açılamıyor.",
  too_large: "Dosya çok büyük (16 MB üstü); açılamıyor.",
  is_dir: "Bu bir klasör, dosya değil.",
};

const CODED = /^\[([a-z_]+)\]\s*/;

/** Splits a rejected fs command into its code and the raw OS text. */
export function parseFsError(error: unknown): { code: FsErrorCode; detail: string } {
  const text = error instanceof Error ? error.message : String(error);
  const match = CODED.exec(text);
  const code = match?.[1];
  if (match && code && code in MESSAGES) {
    return { code: code as FsErrorCode, detail: text.slice(match[0].length) };
  }
  return { code: "unknown", detail: text };
}

/** Human, Turkish message for a failed fs command; unknown errors keep their own text. */
export function describeFsError(error: unknown): string {
  const { code, detail } = parseFsError(error);
  return code === "unknown" ? detail : MESSAGES[code];
}
