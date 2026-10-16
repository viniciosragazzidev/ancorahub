/** What the vision model answers when the image has no readable text (photo, logo, banner). */
export const NO_TEXT_MARKER = "SEM_TEXTO";

/** Added to every chunk read from an image so the quote assistant warns before quoting a value. */
export const IMAGE_MATERIAL_NOTICE = "[Leitura automática de imagem: confirme os valores no material original.]";

export const IMAGE_EXTRACTION_INSTRUCTION = [
  "Transcreva fielmente todo o texto visível nesta imagem, em português.",
  "Se houver tabela, mantenha uma linha por registro e use ' | ' entre as colunas.",
  "Copie números, valores e porcentagens exatamente como aparecem. Não resuma, não interprete e não invente nada.",
  `Se a imagem não tiver texto legível (foto, logo, figura), responda somente ${NO_TEXT_MARKER}.`,
].join(" ");

/** Shorter than this is a caption or a few words, not material worth publishing. */
const MIN_IMAGE_TEXT_CHARS = 120;

export const IMAGE_MIME_TYPES: ReadonlySet<string> = new Set(["image/jpeg", "image/png", "image/webp"]);

/** The text read from an image when it is substantial enough to publish, otherwise null. */
export function usableImageText(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text || text.toUpperCase().startsWith(NO_TEXT_MARKER)) return null;
  return text.length >= MIN_IMAGE_TEXT_CHARS ? text : null;
}
