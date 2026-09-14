/** Media types that the conversations UI can render. Safe for Server Components. */
export function isMediaKindSupported(kind: string | null | undefined): boolean {
  return kind === "image" || kind === "audio" || kind === "video" || kind === "document";
}

