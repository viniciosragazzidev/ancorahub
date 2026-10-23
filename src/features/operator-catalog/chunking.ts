/**
 * Chunks for the operator RAG (Fase 1, 23/10). A price table read from a PDF is a run of
 * lines full of numbers: cut by size alone, its title ("Planos PME - Porte I - 2 vidas")
 * and its column header ("Amil S380 QC ...") land in one chunk and its rows in another,
 * so a search finds the title and never the prices. Here:
 * - a chunk never cuts a line;
 * - every chunk restarts with the section it is in (the last short title lines) and, inside
 *   a table, with the table's header line;
 * - consecutive text chunks overlap a little, so a rule split across two keeps its context;
 * - the caller prepends a context header (operator, type, title) to each chunk
 *   ("contextual retrieval"), which goes into the search and the embedding.
 * Pure: tested in chunking.test.ts.
 */

export const CHUNK_VERSION = "v2";
const DEFAULT_MAX_CHARS = 1400;
const DEFAULT_OVERLAP_CHARS = 160;

/** A table row: three or more numbers (prices, ages, percentages) on one line. */
export function isTableRow(line: string) {
  const numbers = line.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return numbers.length >= 3 && numbers.join("").length >= line.replace(/\s/g, "").length * 0.35;
}

/** A section title: short line, few numbers, not ending like a sentence fragment. */
export function isHeadingLine(line: string) {
  const text = line.trim();
  if (text.length < 4 || text.length > 90) return false;
  if (isTableRow(text)) return false;
  const digits = (text.match(/\d/g) ?? []).length;
  if (digits > text.length * 0.3) return false;
  // Ends with sentence punctuation = a sentence, not a title.
  return !/[.;,]$/.test(text);
}

type Line = { text: string; heading: boolean; tableRow: boolean };

export function structuredChunks(text: string, options: { maxChars?: number; overlapChars?: number } = {}) {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlap = options.overlapChars ?? DEFAULT_OVERLAP_CHARS;
  const lines: Line[] = text.split("\n").map((raw) => raw.trimEnd()).filter((raw) => raw.trim()).map((raw) => ({
    text: raw.slice(0, maxChars),
    heading: isHeadingLine(raw),
    tableRow: isTableRow(raw),
  }));

  const chunks: string[] = [];
  let current: string[] = [];
  let size = 0;
  // The section context: the latest headings (a title and its sub-title).
  let headings: string[] = [];
  // Inside a table: the header line just before its first row.
  let tableHeader: string | null = null;
  let previous: Line | null = null;

  const flush = () => {
    if (current.length && current.some((line) => line.trim())) chunks.push(current.join("\n"));
    current = [];
    size = 0;
  };
  const restartWithContext = (inTable: boolean) => {
    const context = [...headings];
    if (inTable && tableHeader && !context.includes(tableHeader)) context.push(tableHeader);
    current = [...context];
    size = context.join("\n").length;
  };

  for (const line of lines) {
    if (line.tableRow && previous && !previous.tableRow) tableHeader = previous.text;
    if (!line.tableRow && previous?.tableRow) tableHeader = null;
    if (line.heading && !line.tableRow) {
      // Consecutive headings stack (title + sub-title); after body text a new section starts.
      headings = previous?.heading ? [...headings, line.text].slice(-3) : [line.text];
    }

    if (size + line.text.length + 1 > maxChars && current.length) {
      const tail = !line.tableRow && overlap > 0 ? current.join("\n").slice(-overlap) : "";
      flush();
      restartWithContext(line.tableRow);
      // Text overlap (never for table rows: a repeated row would double a price).
      if (tail && !current.includes(tail)) {
        const cleanTail = tail.slice(tail.indexOf("\n") + 1 || 0);
        if (cleanTail.trim()) { current.push(cleanTail); size += cleanTail.length + 1; }
      }
    }
    current.push(line.text);
    size += line.text.length + 1;
    previous = line;
  }
  flush();
  return chunks;
}

/** The context line written before each chunk: operator, kind of material and its title. */
export function chunkContextHeader(input: { carrierName: string | null; documentLabel: string; title: string; plans?: string[] }) {
  const parts = [input.carrierName, input.documentLabel, input.title].filter((part): part is string => Boolean(part && part.trim()));
  const plans = input.plans?.length ? ` · Planos: ${input.plans.slice(0, 8).join(", ")}` : "";
  return `[${parts.join(" · ")}${plans}]`;
}
