import { inflateRawSync } from "node:zlib";
import { z } from "zod";
import { ErpError } from "./contracts";
import { readOpenXmlRows } from "./openxml-reader";

export const IMPORT_LAYOUTS = {
  implantations: ["negocio_id", "referencia", "etapa", "apolice", "inicio_cobertura", "evidencia_id", "motivo"],
  finance: ["referencia", "tipo", "venda_id", "unidade_id", "beneficiario_id", "valor", "vencimento", "competencia", "descricao"],
} as const;
export type ImportDomain = keyof typeof IMPORT_LAYOUTS;
export type ParsedImportRow = { line: number; values: Record<string, string> };

export function parseCsv(text: string, maxRows: number): unknown[][] {
  if (text.includes("\0")) throw new ErpError("O arquivo contém caracteres inválidos.");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes(";") ? ";" : ",";
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false; let closedQuote = false;
  function endCell() { row.push(cell); cell = ""; closedQuote = false; if (row.length > 20) throw new ErpError("O arquivo tem colunas além do modelo permitido."); }
  function endRow() { endCell(); if (row.some((value) => value.trim() !== "")) rows.push(row); row = []; if (rows.length > maxRows + 1) throw new ErpError(`O lote aceita até ${maxRows} linhas de dados.`); }
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') { if (text[index + 1] === '"') { cell += '"'; index += 1; } else { quoted = false; closedQuote = true; } }
      else cell += character;
    } else if (character === '"' && cell === "" && !closedQuote) quoted = true;
    else if (character === delimiter) endCell();
    else if (character === "\r" || character === "\n") { if (character === "\r" && text[index + 1] === "\n") index += 1; endRow(); }
    else if (closedQuote || character === '"') throw new ErpError("Confira as aspas e os separadores do CSV.");
    else cell += character;
    if (cell.length > 2000) throw new ErpError("Uma célula ultrapassa o limite de texto permitido.");
  }
  if (quoted) throw new ErpError("O CSV tem uma célula com aspas não encerradas.");
  if (cell || row.length || closedQuote) endRow();
  return rows;
}

/** Validate and bounded-inflate ZIP entries before reading the OpenXML parts. */
export function validateWorkbookArchive(bytes: Buffer) {
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index -= 1) {
    if (bytes.readUInt32LE(index) === 0x06054b50) { end = index; break; }
  }
  if (end < 0) throw new ErpError("Planilha XLSX inválida. Use o modelo ou salve como CSV UTF-8.");
  const entries = bytes.readUInt16LE(end + 10); const directorySize = bytes.readUInt32LE(end + 12); let offset = bytes.readUInt32LE(end + 16);
  if (bytes.readUInt16LE(end + 4) !== 0 || bytes.readUInt16LE(end + 6) !== 0 || entries < 1 || entries > 64 || offset + directorySize > end) throw new ErpError("O arquivo XLSX tem uma estrutura não permitida.");
  let total = 0; const files = new Map<string, Buffer>(); const directoryEnd = offset + directorySize;
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50) throw new ErpError("Diretório de planilha inválido.");
    const flags = bytes.readUInt16LE(offset + 8); const method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20); const expanded = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28); const extraLength = bytes.readUInt16LE(offset + 30); const commentLength = bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42); const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (offset + 46 + nameLength + extraLength + commentLength > directoryEnd || name.includes("\\") || name.split("/").some((part) => part === "..") || files.has(name)) throw new ErpError("Caminhos da planilha inválidos ou repetidos.");
    if ((flags & 1) || ![0, 8].includes(method) || expanded > 8 * 1024 * 1024 || /(?:vba|externalLinks|embeddings)/i.test(name) || local + 30 > bytes.length || bytes.readUInt32LE(local) !== 0x04034b50) throw new ErpError("A planilha contém conteúdo ou compactação não permitidos. Use CSV UTF-8.");
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    if (start + compressed > bytes.length || start < 0) throw new ErpError("Conteúdo de planilha inválido.");
    let actual: Buffer;
    try { actual = method === 8 ? inflateRawSync(bytes.subarray(start, start + compressed), { maxOutputLength: 8 * 1024 * 1024 }) : bytes.subarray(start, start + compressed); }
    catch { throw new ErpError("A compactação da planilha ultrapassa o limite permitido."); }
    total += actual.length;
    if (actual.length !== expanded || total > 16 * 1024 * 1024) throw new ErpError("A planilha expandida ultrapassa o limite permitido.");
    files.set(name, actual);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function normalizedHeader(value: unknown) { return typeof value === "string" ? value.replace(/^\uFEFF/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : ""; }
const excelDateSchema = z.object({ excelDate: z.iso.date() }).strict();

export function parseImportFile(bytes: Buffer, fileName: string, domain: ImportDomain, maxRows: number): ParsedImportRow[] {
  if (bytes.length < 1 || bytes.length > 2 * 1024 * 1024 || !Number.isInteger(maxRows) || maxRows < 1 || maxRows > 500) throw new ErpError("Use um CSV UTF-8 ou XLSX de até 2 MB, dentro do limite de linhas configurado.");
  let grid: unknown[][];
  if (/\.csv$/i.test(fileName)) {
    let text: string; try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new ErpError("Salve o CSV com codificação UTF-8 antes de enviar."); }
    grid = parseCsv(text, maxRows);
  } else if (/\.xlsx$/i.test(fileName)) {
    grid = readOpenXmlRows(validateWorkbookArchive(bytes), maxRows);
  } else throw new ErpError("Use um arquivo CSV UTF-8 ou XLSX.");
  if (grid.length < 2 || grid.length > maxRows + 1) throw new ErpError(`O lote deve ter de 1 a ${maxRows} linhas de dados.`);
  const headers = grid[0].map(normalizedHeader); const expected: readonly string[] = IMPORT_LAYOUTS[domain];
  if (headers.length !== expected.length || new Set(headers).size !== headers.length || headers.some((header) => !expected.includes(header))) throw new ErpError("Os cabeçalhos não correspondem ao modelo desta importação. Baixe o modelo correto.");
  return grid.slice(1).map((cells, index) => {
    if (cells.length > headers.length) throw new ErpError(`A linha ${index + 2} tem colunas excedentes.`);
    const values: Record<string, string> = {};
    for (let column = 0; column < headers.length; column += 1) {
      const header = headers[column]; let value: unknown = cells[column] ?? "";
      if (value && typeof value === "object") {
        const parsed = excelDateSchema.safeParse(value);
        if (!parsed.success || !["vencimento", "inicio_cobertura", "competencia"].includes(header)) throw new ErpError(`Confira o formato da célula na linha ${index + 2}.`);
        value = header === "competencia" ? parsed.data.excelDate.slice(0, 7) : parsed.data.excelDate;
      }
      if (typeof value === "number" && header !== "valor") throw new ErpError(`Use texto para referências e identificadores na linha ${index + 2}.`);
      if ((typeof value !== "string" && typeof value !== "number") || String(value).length > 2000 || /^[=+@]/.test(String(value).trimStart())) throw new ErpError(`Confira o conteúdo da linha ${index + 2}. Fórmulas não são permitidas.`);
      values[header] = String(value).trim();
    }
    return { line: index + 2, values };
  });
}
