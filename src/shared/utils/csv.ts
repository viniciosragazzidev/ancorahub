/**
 * Parse CSV text with the given delimiter into an array of row objects.
 * The first row is treated as the header. Quoted fields with embedded
 * delimiters and escaped double-quotes ("" → ") are handled correctly.
 *
 * Works in both Node.js and browser environments.
 */
export function parseCsv(text: string, delimiter: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  function splitLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = splitLine(lines[0]);
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitLine(lines[i]);
    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      row[header] = idx < values.length ? (values[idx] || null) : null;
    });
    rows.push(row);
  }

  return rows;
}
