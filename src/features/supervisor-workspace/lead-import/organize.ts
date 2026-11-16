/**
 * Organizar qualquer lista de contatos (16/11/2026, planilha de 4.000 leads da Valéria).
 *
 * Duas camadas:
 * 1. Sem IA: planilha, CSV ou texto colado do Excel é lido por COLUNA. Cada coluna ganha uma nota (quanto parece
 *    telefone, e-mail ou nome, se repete sempre o mesmo valor, o que diz o cabeçalho). O que sobra (operadora,
 *    "Possui CNPJ"...) vai para a anotação do lead.
 * 2. IA pequena só na dúvida: o modelo recebe a estrutura com números e e-mails mascarados e devolve o MAPA
 *    (qual coluna é o quê, ou quais linhas formam cada contato). Os valores sempre saem do arquivo original, e
 *    toda resposta é conferida aqui antes de valer. Resposta que não fecha é ignorada.
 */
import { EMAIL, PHONE, buildContact, cleanName, markRepeated, parseContactLine, parseContactList, titleCase, type ParsedContact, type StructureAnswer, type StructureRequest } from "./parse-contacts";

export type SourceTable = { name: string; rows: string[][] };
export type ColumnMap = { header: number | null; name: number; phone: number; email: number | null; extras: number[] };
export type Organized = {
  contacts: ParsedContact[];
  mode: "tabela" | "texto";
  map: ColumnMap | null;
  /** Rótulo de cada coluna ("A · CLIENTE"), para mostrar como a planilha foi lida. */
  columns: string[];
  /** false = a leitura automática ficou em dúvida e vale pedir ajuda à IA. */
  confident: boolean;
  /** true = a IA ajudou e a resposta passou na conferência. */
  aiUsed: boolean;
};

const NAME_CELL = /^[\p{L}][\p{L}\s.'´`-]{0,79}$/u;
const HEADER_WORD = /^(nome|nome completo|cliente|name|contato|telefone|tel|celular|cel|whats(app)?|fone|phone|e-?mail|operadora|n[uú]mero)\b/i;
const NAME_HEADER = /^(nome|cliente|name|raz[aã]o)/i;
const PHONE_HEADER = /(tel|cel|fone|whats|phone|contato|n[uú]mero)/i;
const EMAIL_HEADER = /e-?mail/i;

const letter = (index: number) => (index < 26 ? String.fromCharCode(65 + index) : `${String.fromCharCode(64 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`);

export function isPhoneCell(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 13 && /^[\d\s()+.-]+$/.test(value.trim());
}
const isEmailCell = (value: string) => EMAIL.test(value) && value.trim().split(/\s+/).length === 1;
const isNameCell = (value: string) => NAME_CELL.test(value.trim()) && value.trim().split(/\s+/).length <= 7;

/** Texto colado do Excel (tabs) ou CSV (; ou ,) vira tabela. Texto solto devolve null. */
export function textToTable(text: string): string[][] | null {
  const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim());
  if (lines.length < 2) return null;
  for (const separator of ["\t", ";", ","]) {
    const counts = lines.map((line) => line.split(separator).length - 1);
    const withIt = counts.filter((count) => count > 0).length;
    if (separator === "\t" ? withIt / lines.length >= 0.6 : (() => {
      // ; e , só valem com a mesma quantidade em quase todas as linhas ("Silva, Maria" solto não é CSV).
      const common = mode(counts);
      return common > 0 && counts.filter((count) => count === common).length / lines.length >= 0.8;
    })()) {
      return lines.map((line) => splitCsvLine(line, separator));
    }
  }
  return null;
}

function mode(values: number[]) {
  const tally = new Map<number, number>();
  for (const value of values) tally.set(value, (tally.get(value) ?? 0) + 1);
  return [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

function splitCsvLine(line: string, separator: string) {
  if (separator === "\t") return line.split("\t").map((cell) => cell.trim());
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === separator && !quoted) { cells.push(current.trim()); current = ""; }
    else current += char;
  }
  cells.push(current.trim());
  return cells;
}

const width = (rows: string[][]) => rows.reduce((max, row) => Math.max(max, row.length), 0);
const cell = (row: string[] | undefined, index: number | null) => (index === null || !row ? "" : String(row[index] ?? "").trim());

/** Linha de cabeçalho: nas primeiras linhas, a que tem palavras de cabeçalho e nenhum telefone. */
export function findHeader(rows: string[][]): number | null {
  for (let index = 0; index < Math.min(rows.length, 6); index += 1) {
    const cells = rows[index].map((value) => String(value ?? "").trim()).filter(Boolean);
    if (cells.length >= 2 && cells.some((value) => HEADER_WORD.test(value)) && !cells.some(isPhoneCell)) return index;
  }
  return null;
}

type ColumnScore = { index: number; filled: number; phone: number; email: number; name: number; distinct: number };

function scoreColumns(rows: string[][], header: number | null): ColumnScore[] {
  const data = rows.slice(header === null ? 0 : header + 1).filter((row) => row.filter((value) => String(value ?? "").trim()).length >= 2).slice(0, 400);
  return Array.from({ length: width(rows) }, (_, index) => {
    const values = data.map((row) => cell(row, index)).filter(Boolean);
    const filled = values.length || 1;
    return {
      index,
      filled: values.length / Math.max(1, data.length),
      phone: values.filter(isPhoneCell).length / filled,
      email: values.filter(isEmailCell).length / filled,
      name: values.filter(isNameCell).length / filled,
      distinct: new Set(values.map((value) => value.toLowerCase())).size / filled,
    };
  });
}

/** Camada 1: o mapa das colunas, sem IA. `confident` = sem empate e com nota alta. */
export function profileColumns(rows: string[][]): { map: ColumnMap | null; confident: boolean } {
  const header = findHeader(rows);
  const headers = header === null ? [] : rows[header].map((value) => String(value ?? "").trim());
  const scores = scoreColumns(rows, header);
  const best = (pick: (score: ColumnScore) => number, min: number, skip: Array<number | null>) => {
    const ranked = scores.filter((score) => !skip.includes(score.index) && score.filled > 0.3).map((score) => ({ index: score.index, value: pick(score) })).sort((a, b) => b.value - a.value);
    return { top: ranked[0] && ranked[0].value >= min ? ranked[0] : null, second: ranked[1] ?? null };
  };
  const hint = (index: number, pattern: RegExp) => (pattern.test(headers[index] ?? "") ? 0.15 : 0);

  const phone = best((score) => score.phone + hint(score.index, PHONE_HEADER), 0.5, []);
  if (!phone.top) return { map: null, confident: false };
  const email = best((score) => score.email + hint(score.index, EMAIL_HEADER), 0.3, [phone.top.index]);
  // Coluna que repete sempre o mesmo valor ("Google", "Unimed") não é nome de gente.
  const name = best((score) => score.name * (score.distinct < 0.6 ? 0.3 : 1) + hint(score.index, NAME_HEADER), 0.5, [phone.top.index, email.top?.index ?? null]);
  if (!name.top) return { map: null, confident: false };

  const used = new Set([phone.top.index, name.top.index, email.top?.index].filter((value): value is number => value !== undefined));
  const extras = scores.filter((score) => !used.has(score.index) && score.filled > 0).map((score) => score.index);
  const phoneScore = scores[phone.top.index].phone;
  const confident = phoneScore >= 0.7 && name.top.value >= 0.6 && (!name.second || name.top.value - name.second.value >= 0.15) && (!phone.second || phone.top.value - phone.second.value >= 0.15);
  return { map: { header, name: name.top.index, phone: phone.top.index, email: email.top?.index ?? null, extras }, confident };
}

export function columnLabels(rows: string[][], header: number | null) {
  return Array.from({ length: width(rows) }, (_, index) => {
    const title = header === null ? "" : cell(rows[header], index);
    return title ? `${letter(index)} · ${title}` : letter(index);
  });
}

/** Aplica o mapa: valores sempre tirados das células originais. */
export function tableToContacts(rows: string[][], map: ColumnMap): ParsedContact[] {
  const headers = map.header === null ? [] : rows[map.header].map((value) => String(value ?? "").trim());
  const contacts: ParsedContact[] = [];
  rows.forEach((row, index) => {
    if (map.header !== null && index <= map.header) return;
    const filled = row.map((value) => String(value ?? "").trim()).filter(Boolean);
    if (!filled.length) return;
    let rawName = cell(row, map.name);
    const phoneRaw = cell(row, map.phone);
    let email = map.email === null ? "" : cell(row, map.email);
    // Cabeçalho repetido no meio da planilha ou linha de título ("MARISA – 10/11").
    if (!isPhoneCell(phoneRaw) && filled.some((value) => HEADER_WORD.test(value))) return;
    if (!phoneRaw && filled.length === 1) return;
    // E-mail escrito na coluna do nome.
    const emailInName = rawName.match(EMAIL)?.[0];
    if (emailInName) {
      rawName = rawName.replace(EMAIL, " ");
      email ||= emailInName;
    }
    const note = map.extras
      .map((column) => {
        const value = cell(row, column);
        if (!value) return "";
        const title = headers[column];
        return title && title.toLowerCase() !== value.toLowerCase() ? `${title}: ${value}` : value;
      })
      .filter(Boolean)
      .join(" · ");
    contacts.push(buildContact({
      line: index + 1,
      name: titleCase(cleanName(rawName)),
      phoneRaw: phoneRaw ? (phoneRaw.match(PHONE)?.[0] ?? phoneRaw) : null,
      email: email.match(EMAIL)?.[0]?.toLowerCase() ?? null,
      note: note || null,
    }));
  });
  return markRepeated(contacts);
}

/** Planilha ou tabela colada. */
export function organizeTable(rows: string[][]): Organized {
  const { map, confident } = profileColumns(rows);
  if (!map) return { contacts: [], mode: "tabela", map: null, columns: columnLabels(rows, findHeader(rows)), confident: false, aiUsed: false };
  return { contacts: tableToContacts(rows, map), mode: "tabela", map, columns: columnLabels(rows, map.header), confident, aiUsed: false };
}

/** Texto colado: se tiver colunas (Excel, CSV), lê como tabela; senão, linha a linha. */
export function organizeText(text: string): Organized {
  const table = /BEGIN:VCARD/i.test(text) ? null : textToTable(text);
  if (table) {
    const organized = organizeTable(table);
    if (organized.map) return organized;
  }
  const contacts = parseContactList(text, Number.POSITIVE_INFINITY).contacts;
  const lines = text.split("\n").filter((line) => line.trim()).length;
  const loose = contacts.filter((contact) => contact.problem === "Sem nome." || contact.problem === "Sem telefone.").length;
  return { contacts, mode: "texto", map: null, columns: [], confident: lines < 4 || loose / Math.max(1, contacts.length) <= 0.25, aiUsed: false };
}

// ---------- Camada 2: o pedido e a conferência da resposta da IA ----------

/** Número vira #, e-mail perde a parte antes do @. A IA só precisa do formato. */
export function maskForAi(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi, "xxx@$1")
    .replace(/\d/g, "#")
    .slice(0, 60);
}

export const AI_TABLE_ROWS = 12;
export const AI_TEXT_LINES = 300;

export function tableRequest(rows: string[][]): StructureRequest {
  const sample = rows.filter((row) => row.some((value) => String(value ?? "").trim())).slice(0, AI_TABLE_ROWS);
  return { kind: "tabela", rows: sample.map((row) => row.slice(0, 15).map((value) => maskForAi(String(value ?? "").trim()))) };
}

export function textRequest(text: string): StructureRequest | null {
  const lines = text.replace(/\r/g, "").split("\n");
  if (lines.length > AI_TEXT_LINES) return null;
  return { kind: "texto", lines: lines.map(maskForAi) };
}

/** Confere o mapa da IA contra a própria planilha. Mapa que não fecha volta null. */
export function applyTableAnswer(rows: string[][], answer: StructureAnswer): Organized | null {
  if (answer.kind !== "tabela") return null;
  const columns = width(rows);
  const picked = [answer.name, answer.phone, answer.email].filter((value): value is number => value !== null);
  if (picked.some((value) => !Number.isInteger(value) || value < 0 || value >= columns) || new Set(picked).size !== picked.length) return null;
  if (answer.header !== null && (!Number.isInteger(answer.header) || answer.header < 0 || answer.header >= Math.min(rows.length, AI_TABLE_ROWS))) return null;
  // A coluna do telefone tem de ter telefone de verdade.
  const scores = scoreColumns(rows, answer.header);
  if (scores[answer.phone].phone < 0.5) return null;
  const used = new Set(picked);
  const map: ColumnMap = {
    header: answer.header,
    name: answer.name,
    phone: answer.phone,
    email: answer.email,
    extras: scores.filter((score) => !used.has(score.index) && score.filled > 0).map((score) => score.index),
  };
  return { contacts: tableToContacts(rows, map), mode: "tabela", map, columns: columnLabels(rows, map.header), confident: true, aiUsed: true };
}

/** Confere os grupos de linhas da IA: linhas que existem, sem repetir, no máximo 4 por contato. */
export function applyTextAnswer(text: string, answer: StructureAnswer): Organized | null {
  if (answer.kind !== "texto") return null;
  const lines = text.replace(/\r/g, "").split("\n");
  const seen = new Set<number>();
  for (const group of answer.groups) {
    if (!group.length || group.length > 4) return null;
    for (const line of group) {
      if (!Number.isInteger(line) || line < 1 || line > lines.length || seen.has(line)) return null;
      seen.add(line);
    }
  }
  const contacts = answer.groups
    .map((group) => {
      const sorted = [...group].sort((a, b) => a - b);
      return parseContactLine(sorted.map((line) => lines[line - 1]).join("  "), sorted[0]);
    })
    .filter((contact): contact is ParsedContact => Boolean(contact));
  if (!contacts.length) return null;
  return { contacts: markRepeated(contacts), mode: "texto", map: null, columns: [], confident: true, aiUsed: true };
}

/**
 * O lote: a partir de `cursor`, os próximos contatos sem problema (até `limit`) e os que ficaram de fora no
 * caminho. `end` = de onde o próximo lote começa.
 */
export function nextSlice(contacts: ParsedContact[], cursor: number, limit: number) {
  const candidates: ParsedContact[] = [];
  const skipped: ParsedContact[] = [];
  let end = cursor;
  while (end < contacts.length && candidates.length < limit) {
    const contact = contacts[end];
    if (contact.phone && !contact.problem) candidates.push(contact);
    else skipped.push(contact);
    end += 1;
  }
  return { candidates, skipped, end };
}

export const readyCount = (contacts: ParsedContact[], from = 0) => contacts.slice(from).filter((contact) => contact.phone && !contact.problem).length;
