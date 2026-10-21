/** Authenticated route that streams one message's media (scope checked on the server). */
export function conversationMediaUrl(messageId: string): string {
  return `/api/conversations/media/${encodeURIComponent(messageId)}`;
}

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
  "[unsupported]": "Mensagem que o sistema não mostra, veja no WhatsApp",
};

/**
 * Readable label for the "[audio]"-style body a WhatsApp message gets when
 * it carried no text and its file could not be kept; null for real text.
 */
export function mediaPlaceholderLabel(body: string | null | undefined): string | null {
  return body ? PLACEHOLDER_LABELS[body.trim().toLowerCase()] ?? null : null;
}

/**
 * True for a WhatsApp row/event that carries nothing to show: no text and no
 * file, stored as "[text]" (or empty). These are protocol events from the
 * WhatsApp session (revoked/deleted messages, security-code notices, call
 * logs, reactions, undecrypted "waiting for this message" stubs), not
 * something the client wrote. The conversation hides them instead of drawing
 * a "[text]" bubble on the client's side.
 */
export function isContentlessMessage(body: string | null | undefined, mediaKind?: string | null): boolean {
  if (mediaKind) return false;
  const text = (body ?? "").trim().toLowerCase();
  return text === "" || text === "[text]";
}
