/** Media types that the conversations UI can render. Safe for Server Components. */
export function isMediaKindSupported(kind: string | null | undefined): boolean {
  return kind === "image" || kind === "audio" || kind === "video" || kind === "document";
}


const PLACEHOLDER_LABELS: Record<string, string> = {
  "[audio]": "Áudio indisponível",
  "[image]": "Imagem indisponível",
  "[video]": "Vídeo indisponível",
  "[document]": "Documento indisponível",
  "[sticker]": "Figurinha",
  "[location]": "Localização compartilhada",
  "[contact]": "Contato compartilhado",
  "[text]": "Mensagem sem texto",
};

/**
 * Readable label for the "[audio]"-style body a WhatsApp message gets when
 * it carried no text and its file could not be kept; null for real text.
 */
export function mediaPlaceholderLabel(body: string | null | undefined): string | null {
  return body ? PLACEHOLDER_LABELS[body.trim().toLowerCase()] ?? null : null;
}
