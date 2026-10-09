/**
 * Reads an escala spreadsheet laid out as the Âncora's PME sheet: one header
 * row starting with "Dias" and one date per column, then the brokers of that
 * date below it as "<code> - <name>". Pure: the import script feeds it the
 * sheet as a matrix (xlsx `sheet_to_json(..., { header: 1, raw: true })`).
 */

export type ImportedBroker = { code: string; name: string };
export type ImportedShift = "manha" | "tarde";
/** One date (and, for split plantões, one shift) with its brokers. */
export type ImportedDay = { date: string; shift?: ImportedShift | null; brokers: ImportedBroker[] };
export type ParsedEscala = { days: ImportedDay[]; unreadable: Array<{ date: string; text: string }> };

const BROKER_CELL = /^\s*0*(\d+)\s*-\s*(.+?)\s*$/;

/** Excel serial day (1900 system) to YYYY-MM-DD. */
export function excelSerialToDate(serial: number) {
  const ms = Math.round((serial - 25569) * 86_400_000);
  return new Date(ms).toISOString().slice(0, 10);
}

function cellDate(value: unknown) {
  if (typeof value === "number" && value > 30000 && value < 80000) return excelSerialToDate(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (typeof value === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(value.trim())) {
    const [day, month, year] = value.trim().split("/");
    return `${year}-${month}-${day}`;
  }
  return null;
}

/** Broker code as the CRM stores it, without leading zeros ("0406" and "406" are the same). */
export const normalizeBrokerCode = (code: string | null | undefined) => (code ?? "").trim().replace(/^0+(?=\d)/, "");

export function parseEscalaSheet(rows: unknown[][]): ParsedEscala {
  const headerIndex = rows.findIndex((row) => typeof row?.[0] === "string" && row[0].trim().toLocaleLowerCase("pt-BR") === "dias");
  if (headerIndex < 0) throw new Error("Não encontrei a linha de cabeçalho que começa com \"Dias\".");
  const header = rows[headerIndex] ?? [];
  const days: ImportedDay[] = [];
  const unreadable: ParsedEscala["unreadable"] = [];
  for (let column = 1; column < header.length; column += 1) {
    const date = cellDate(header[column]);
    if (!date) continue;
    const brokers: ImportedBroker[] = [];
    for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
      const raw = rows[rowIndex]?.[column];
      if (raw === undefined || raw === null || String(raw).trim() === "") continue;
      const match = BROKER_CELL.exec(String(raw));
      if (!match) {
        unreadable.push({ date, text: String(raw).trim() });
        continue;
      }
      const code = normalizeBrokerCode(match[1]);
      if (!brokers.some((broker) => broker.code === code)) brokers.push({ code, name: match[2].replace(/\s+/g, " ") });
    }
    days.push({ date, brokers });
  }
  return { days: days.sort((a, b) => a.date.localeCompare(b.date)), unreadable };
}

/** Seats each broker takes in the imported escala (one per date). */
export function seatsByBroker(days: readonly ImportedDay[]) {
  const seats = new Map<string, number>();
  for (const day of days) for (const broker of day.brokers) seats.set(broker.code, (seats.get(broker.code) ?? 0) + 1);
  return seats;
}

const NAME_STOPWORDS = new Set(["da", "de", "do", "das", "dos", "e"]);
const nameTokens = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z\s]/g, " ").split(/\s+/).filter((token) => token && !NAME_STOPWORDS.has(token));

export type NameMatch<T> = { kind: "match"; candidate: T } | { kind: "ambiguous"; candidates: T[] } | { kind: "none" };

/**
 * Finds a broker by name when the sheet code is not the CRM code. Every word
 * of the sheet name must start a word of the CRM name, in order (the sheet
 * cuts long names: "ANGELA CRISTINA DOS SANTO" -> "Angela Cristina dos Santos").
 * Only a single candidate counts as a match.
 */
export function matchBrokerByName<T extends { name: string }>(sheetName: string, candidates: readonly T[]): NameMatch<T> {
  const wanted = nameTokens(sheetName);
  if (wanted.length < 2) return { kind: "none" };
  const hits = candidates.filter((candidate) => {
    const tokens = nameTokens(candidate.name);
    let position = 0;
    for (const word of wanted) {
      while (position < tokens.length && !tokens[position].startsWith(word)) position += 1;
      if (position >= tokens.length) return false;
      position += 1;
    }
    return true;
  });
  if (hits.length === 1) return { kind: "match", candidate: hits[0] };
  return hits.length ? { kind: "ambiguous", candidates: hits } : { kind: "none" };
}

/**
 * Codes written inside a CRM name ("Dandhara Lima 6580" -> 6580): the Âncora
 * keeps the sheet code in the broker name, not in the CRM code field.
 */
export function codesInName(name: string) {
  return [...name.matchAll(/(?:^|\D)(\d{2,6})(?=\D|$)/g)].map((match) => normalizeBrokerCode(match[1]));
}

const fold = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");

/**
 * Reads the "SLOTS" tab of the Âncora automatic escala: one row per seat with
 * Destino (unit), Tipo, Turno (Manhã/Tarde), Data and "Corretor alocado".
 * Only rows of `tipo` (e.g. "Presencial") with a broker are read; seats are
 * grouped by date and shift. The unit is not needed: one plantão per shift
 * serves every unit (each broker works at their own unit).
 */
export function parseSlotsSheet(rows: unknown[][], tipo: string): ParsedEscala {
  const header = (rows[0] ?? []).map(fold);
  const column = (name: string) => header.findIndex((cell) => cell === fold(name));
  const tipoAt = column("Tipo");
  const turnoAt = column("Turno");
  const dataAt = column("Data");
  const corretorAt = column("Corretor alocado");
  if ([tipoAt, turnoAt, dataAt, corretorAt].some((index) => index < 0)) throw new Error("A aba SLOTS precisa das colunas Tipo, Turno, Data e Corretor alocado.");
  const byKey = new Map<string, ImportedDay>();
  const unreadable: ParsedEscala["unreadable"] = [];
  for (const row of rows.slice(1)) {
    if (fold(row?.[tipoAt]) !== fold(tipo)) continue;
    const raw = row?.[corretorAt];
    if (raw === undefined || raw === null || String(raw).trim() === "" || String(raw).trim() === "0") continue;
    const date = cellDate(row?.[dataAt]);
    if (!date) continue;
    const turno = fold(row?.[turnoAt]);
    const shift: ImportedShift | null = turno.startsWith("manh") ? "manha" : turno.startsWith("tard") ? "tarde" : null;
    const match = BROKER_CELL.exec(String(raw));
    if (!match) {
      unreadable.push({ date, text: String(raw).trim() });
      continue;
    }
    const key = `${date}|${shift ?? ""}`;
    const day = byKey.get(key) ?? { date, shift, brokers: [] };
    const code = normalizeBrokerCode(match[1]);
    if (!day.brokers.some((broker) => broker.code === code)) day.brokers.push({ code, name: match[2].replace(/\s+/g, " ") });
    byKey.set(key, day);
  }
  const order = { manha: 0, tarde: 1 } as const;
  return {
    days: [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date) || (a.shift ? order[a.shift] : 2) - (b.shift ? order[b.shift] : 2)),
    unreadable,
  };
}
