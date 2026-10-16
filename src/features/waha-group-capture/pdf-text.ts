import { extractText } from "unpdf";

/** Plain text of every page of a PDF, pages joined in order. Scanned PDFs return little or no text. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { text } = await extractText(bytes, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}
