const MEDIA_LABELS: Record<string, string> = { audio: "áudio", image: "imagem", video: "vídeo", document: "documento", sticker: "figurinha" };

/**
 * A media message as text: "[áudio]" or "[documento: proposta.pdf]", with its caption when there is one.
 * Read by people (the exported conversation) and by the AI (a quote sent as a PDF is part of the funnel).
 */
export function conversationMessageBody(input: { body: string | null; mediaKind: string | null; mediaFilename: string | null }) {
  const body = (input.body ?? "").trim();
  if (!input.mediaKind) return body;
  const label = MEDIA_LABELS[input.mediaKind] ?? input.mediaKind;
  const tag = `[${label}${input.mediaFilename ? `: ${input.mediaFilename}` : ""}]`;
  const caption = /^\[[^\]]*\]$/.test(body) ? "" : body;
  return caption ? `${tag} ${caption}` : tag;
}
