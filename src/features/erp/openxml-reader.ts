import { posix } from "node:path";
import { ErpError, dateSchema } from "./contracts";

type XmlVisitor = { open?: (name: string, attributes: ReadonlyMap<string, string>) => void; close?: (name: string) => void; text?: (text: string) => void };

function entities(text: string) {
  let result = ""; let cursor = 0;
  for (;;) {
    const start = text.indexOf("&", cursor);
    if (start < 0) return result + text.slice(cursor);
    const end = text.indexOf(";", start + 1);
    if (end < 0 || end - start > 32) throw new ErpError("Entidade XML inválida na planilha.");
    result += text.slice(cursor, start); const token = text.slice(start + 1, end);
    const predefined = new Map([["amp", "&"], ["lt", "<"], ["gt", ">"], ["quot", '"'], ["apos", "'"]]);
    if (predefined.has(token)) result += predefined.get(token);
    else {
      const code = /^#x[0-9a-f]{1,6}$/i.test(token) ? Number.parseInt(token.slice(2), 16) : /^#\d{1,7}$/.test(token) ? Number(token.slice(1)) : NaN;
      if (!Number.isInteger(code) || code < 1 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) throw new ErpError("Entidade XML não permitida.");
      result += String.fromCodePoint(code);
    }
    cursor = end + 1;
  }
}

/** Small, bounded OpenXML tokenizer: no DTDs, external entities, objects keyed by input, or evaluation. */
function xml(xmlText: string, visitor: XmlVisitor) {
  const stack: string[] = []; let cursor = 0;
  while (cursor < xmlText.length) {
    const start = xmlText.indexOf("<", cursor);
    if (start < 0) { visitor.text?.(entities(xmlText.slice(cursor))); break; }
    if (start > cursor) visitor.text?.(entities(xmlText.slice(cursor, start)));
    if (xmlText.startsWith("<!--", start)) { const end = xmlText.indexOf("-->", start + 4); if (end < 0) throw new ErpError("Comentário XML inválido."); cursor = end + 3; continue; }
    if (xmlText.startsWith("<![CDATA[", start)) { const end = xmlText.indexOf("]]>", start + 9); if (end < 0) throw new ErpError("Texto XML inválido."); visitor.text?.(xmlText.slice(start + 9, end)); cursor = end + 3; continue; }
    if (xmlText.startsWith("<?xml ", start)) { const end = xmlText.indexOf("?>", start + 6); if (end < 0 || end - start > 1024) throw new ErpError("Cabeçalho XML inválido."); cursor = end + 2; continue; }
    if (xmlText.startsWith("<!", start) || xmlText.startsWith("<?", start)) throw new ErpError("A planilha contém instruções XML não permitidas.");
    let end = start + 1; let quote = "";
    for (; end < xmlText.length; end += 1) {
      const char = xmlText[end]; if (quote) { if (char === quote) quote = ""; } else if (char === '"' || char === "'") quote = char; else if (char === ">") break;
      if (end - start > 4096) throw new ErpError("Uma declaração da planilha ultrapassa o limite permitido.");
    }
    if (end >= xmlText.length) throw new ErpError("XML da planilha não foi encerrado.");
    const tag = xmlText.slice(start + 1, end).trim(); const closing = tag.startsWith("/"); const selfClosing = tag.endsWith("/");
    const match = /^\/?([A-Za-z_][\w:.-]*)/.exec(tag);
    if (!match) throw new ErpError("Elemento XML inválido.");
    const fullName = match[1]; const name = fullName.split(":").at(-1) ?? fullName;
    if (closing) {
      if (tag.slice(match[0].length).trim() || stack.pop() !== fullName) throw new ErpError("Estrutura XML inválida.");
      visitor.close?.(name);
    } else {
      const attributes = new Map<string, string>(); const remaining = tag.slice(match[0].length, selfClosing ? -1 : undefined); let position = 0;
      const attribute = /\s+([A-Za-z_][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/gy;
      while (position < remaining.length) {
        if (!remaining.slice(position).trim()) break;
        attribute.lastIndex = position; const item = attribute.exec(remaining);
        if (!item || attributes.has(item[1])) throw new ErpError("Atributo XML inválido ou repetido.");
        attributes.set(item[1], entities(item[2].slice(1, -1))); position = attribute.lastIndex;
      }
      visitor.open?.(name, attributes);
      if (selfClosing) visitor.close?.(name); else { stack.push(fullName); if (stack.length > 32) throw new ErpError("A planilha tem elementos aninhados demais."); }
    }
    cursor = end + 1;
  }
  if (stack.length) throw new ErpError("A planilha contém XML incompleto.");
}

function textFile(files: ReadonlyMap<string, Buffer>, name: string, optional = false) {
  const bytes = files.get(name);
  if (!bytes) { if (optional) return ""; throw new ErpError("Uma parte obrigatória do XLSX não foi encontrada."); }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new ErpError("O XLSX contém texto inválido."); }
}

export type ExcelDate = { excelDate: string };
export function excelCalendarDate(serial: number, date1904: boolean): string {
  if (!Number.isFinite(serial) || serial < (date1904 ? 0 : 1) || serial > 2958465 || (!date1904 && Math.trunc(serial) === 60)) throw new ErpError("Data de planilha inválida. Use AAAA-MM-DD.");
  const days = Math.trunc(serial); const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
  const result = new Date(base + (days - (!date1904 && days > 60 ? 1 : 0)) * 86400000).toISOString().slice(0, 10);
  if (!dateSchema.safeParse(result).success) throw new ErpError("Data de planilha inválida.");
  return result;
}

export function readOpenXmlRows(files: ReadonlyMap<string, Buffer>, maxRows: number): unknown[][] {
  const sheetIds: string[] = []; let date1904 = false;
  xml(textFile(files, "xl/workbook.xml"), { open(name, attributes) {
    if (name === "sheet") sheetIds.push(attributes.get("r:id") ?? "");
    if (name === "workbookPr") date1904 = ["1", "true"].includes(attributes.get("date1904") ?? "0");
  } });
  if (sheetIds.length !== 1 || !sheetIds[0]) throw new ErpError("Envie um XLSX com apenas uma aba de dados.");
  let sheetPath = "";
  xml(textFile(files, "xl/_rels/workbook.xml.rels"), { open(name, attributes) {
    if (name !== "Relationship" || attributes.get("Id") !== sheetIds[0]) return;
    if (attributes.get("TargetMode") === "External" || !(attributes.get("Type") ?? "").endsWith("/worksheet")) throw new ErpError("A aba não pode depender de um arquivo externo.");
    const target = attributes.get("Target") ?? "";
    sheetPath = posix.normalize(target.startsWith("/") ? target.slice(1) : posix.join("xl", target));
  } });
  if (!/^xl\/worksheets\/[^/]+\.xml$/.test(sheetPath)) throw new ErpError("Referência da aba inválida.");
  const strings: string[] = []; let currentString: string | null = null; let inText = false; let phonetic = false;
  xml(textFile(files, "xl/sharedStrings.xml", true), {
    open(name) { if (name === "si") currentString = ""; if (name === "rPh") phonetic = true; if (name === "t") inText = true; },
    text(value) { if (currentString !== null && inText && !phonetic) { currentString += value; if (currentString.length > 2000) throw new ErpError("Uma célula ultrapassa o limite de texto."); } },
    close(name) { if (name === "t") inText = false; if (name === "rPh") phonetic = false; if (name === "si") { strings.push(currentString ?? ""); currentString = null; if (strings.length > 10000) throw new ErpError("A planilha tem textos demais."); } },
  });
  const dateFormats = new Set([14, 15, 16, 17, 22]); const styles: number[] = []; let inCellFormats = false;
  xml(textFile(files, "xl/styles.xml", true), { open(name, attributes) {
    if (name === "cellXfs") inCellFormats = true;
    if (name === "numFmt") { const format = attributes.get("formatCode") ?? ""; if (format.length > 256) throw new ErpError("Formato de planilha muito extenso."); if (/[yd]/i.test(format.replace(/"[^"]*"|\[[^\]]*\]|\\./g, ""))) dateFormats.add(Number(attributes.get("numFmtId"))); }
    if (name === "xf" && inCellFormats) { styles.push(Number(attributes.get("numFmtId") ?? "0")); if (styles.length > 512) throw new ErpError("A planilha tem formatos demais."); }
  }, close(name) { if (name === "cellXfs") inCellFormats = false; } });
  const rows = new Map<number, Map<number, unknown>>();
  let cell: { row: number; column: number; type: string; style: number; value: string; inline: string } | null = null; let valueKind = "";
  xml(textFile(files, sheetPath), {
    open(name, attributes) {
      if (name === "f") throw new ErpError("Envie valores conferidos, sem fórmulas na planilha.");
      if (name === "c") {
        const coordinate = /^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(attributes.get("r") ?? "");
        if (!coordinate) throw new ErpError("Coordenada de célula inválida.");
        let column = 0; for (const char of coordinate[1]) column = column * 26 + char.charCodeAt(0) - 64;
        cell = { row: Number(coordinate[2]), column: column - 1, type: attributes.get("t") ?? "n", style: Number(attributes.get("s") ?? "0"), value: "", inline: "" };
      }
      if (cell && ["v", "t"].includes(name)) valueKind = name;
    },
    text(value) { if (cell && valueKind) { if (valueKind === "v") cell.value += value; else cell.inline += value; if (cell.value.length > 2000 || cell.inline.length > 2000) throw new ErpError("Uma célula ultrapassa o limite de texto."); } },
    close(name) {
      if (name === "v" || name === "t") valueKind = "";
      if (name !== "c" || !cell) return;
      let value: unknown = cell.value.trim();
      if (cell.type === "s") { const index = /^\d+$/.test(cell.value) ? Number(cell.value) : -1; if (index < 0 || index >= strings.length) throw new ErpError("Texto compartilhado inválido."); value = strings[index]; }
      else if (cell.type === "inlineStr") value = cell.inline;
      else if (cell.type === "e" || cell.type === "b") throw new ErpError("O modelo aceita apenas texto, datas e valores numéricos.");
      else if (cell.type === "d") { const date = cell.value.slice(0, 10); if (!dateSchema.safeParse(date).success) throw new ErpError("Data inválida."); value = { excelDate: date }; }
      else if (cell.type === "n" && value !== "") {
        const number = Number(cell.value); if (!Number.isFinite(number)) throw new ErpError("Número inválido na planilha.");
        value = dateFormats.has(styles[cell.style] ?? 0) ? { excelDate: excelCalendarDate(number, date1904) } : number;
      }
      if (value !== "") {
        if (cell.column > 19) throw new ErpError("O arquivo tem colunas além do modelo permitido.");
        const row = rows.get(cell.row) ?? new Map<number, unknown>();
        if (row.has(cell.column)) throw new ErpError("A planilha repete uma célula.");
        row.set(cell.column, value); rows.set(cell.row, row);
        if (rows.size > maxRows + 1) throw new ErpError(`O lote aceita até ${maxRows} linhas de dados.`);
      }
      cell = null;
    },
  });
  if (!rows.has(1)) throw new ErpError("O cabeçalho precisa estar na primeira linha da aba.");
  return [...rows.entries()].sort(([left], [right]) => left - right).map(([, row]) => Array.from({ length: Math.max(...row.keys()) + 1 }, (_, index) => row.get(index) ?? ""));
}
