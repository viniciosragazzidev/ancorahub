/**
 * Reads an escala spreadsheet laid out as the Âncora's PME sheet: one header
 * row starting with "Dias" and one date per column, then the brokers of that
 * date below it as "<code> - <name>". Pure: the import script feeds it the
 * sheet as a matrix (xlsx `sheet_to_json(..., { header: 1, raw: true })`).
 */

export type ImportedBroker = { code: string; name: string };
export type ImportedDay = { date: string; brokers: ImportedBroker[] };
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
