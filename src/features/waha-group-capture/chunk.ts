/**
 * Splits operator material into retrieval chunks without rewriting it. Tables
 * and price lines stay as extracted, so a value is never reworded by a model.
 */
export function chunkOperatorText(text: string, maxChars = 1200): string[] {
  const pieces: string[] = [];
  for (const paragraph of text.split(/\n\s*\n+/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    if (trimmed.length <= maxChars) {
      pieces.push(trimmed);
      continue;
    }
    // Long paragraph (typically a table): break it by line, never mid-line.
    for (const line of trimmed.split("\n")) {
      if (line.trim()) pieces.push(line.trim());
    }
  }

  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && current.length + piece.length + 1 > maxChars) {
      chunks.push(current);
      current = piece;
    } else {
      current = current ? `${current}\n${piece}` : piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
