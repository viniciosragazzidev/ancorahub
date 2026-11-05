/** CSV compatível com Excel pt-BR: UTF-8 com BOM, separador ponto e vírgula e proteção contra fórmulas. */
export function encodeCsvHeader(columns: readonly string[]) {
  return columns.join(";");
}

export function encodeCsvRow(row: Record<string, unknown>, columns: readonly string[]) {
  const quote = (value: unknown) => {
    if (value == null) return '""';
    const text = value instanceof Date ? value.toISOString() : String(value);
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return columns.map((column) => quote(row[column])).join(";");
}

export function encodeCsvDocument(rows: Record<string, unknown>[], columns = Object.keys(rows[0] ?? {})) {
  return `\uFEFF${[encodeCsvHeader(columns), ...rows.map((row) => encodeCsvRow(row, columns))].join("\r\n")}`;
}
