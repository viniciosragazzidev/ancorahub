/**
 * Feriados que param o expediente da Âncora (09/11/2026), como data local "YYYY-MM-DD" de São Paulo.
 * Lista fixa e curta: nacionais de 2026 e 2027 (Sexta-feira Santa incluída; Carnaval e Corpus Christi
 * são ponto facultativo e ficam de fora) mais os do Rio de Janeiro (20/01 São Sebastião, cidade;
 * 23/04 São Jorge, estado). Consciência Negra (20/11) é nacional desde 2024.
 *
 * Opt-in: só quem passar a usar este módulo considera feriado. Hoje o pós-venda (régua, R0 e lembretes).
 * Para um ano novo, acrescente as datas aqui; ano sem lista conta todo dia de semana como útil.
 */
export const BUSINESS_HOLIDAYS: Readonly<Record<string, string>> = {
  "2026-01-01": "Confraternização Universal",
  "2026-01-20": "São Sebastião (Rio de Janeiro)",
  "2026-04-03": "Sexta-feira Santa",
  "2026-04-21": "Tiradentes",
  "2026-04-23": "São Jorge (RJ)",
  "2026-05-01": "Dia do Trabalho",
  "2026-09-07": "Independência",
  "2026-10-12": "Nossa Senhora Aparecida",
  "2026-11-02": "Finados",
  "2026-11-15": "Proclamação da República",
  "2026-11-20": "Consciência Negra",
  "2026-12-25": "Natal",
  "2027-01-01": "Confraternização Universal",
  "2027-01-20": "São Sebastião (Rio de Janeiro)",
  "2027-03-26": "Sexta-feira Santa",
  "2027-04-21": "Tiradentes",
  "2027-04-23": "São Jorge (RJ)",
  "2027-05-01": "Dia do Trabalho",
  "2027-09-07": "Independência",
  "2027-10-12": "Nossa Senhora Aparecida",
  "2027-11-02": "Finados",
  "2027-11-15": "Proclamação da República",
  "2027-11-20": "Consciência Negra",
  "2027-12-25": "Natal",
};

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

/** Data local de São Paulo como "YYYY-MM-DD". */
export function saoPauloHolidayDateKey(date: Date) {
  return dateKeyFormatter.format(date);
}

/** True quando a data "YYYY-MM-DD" é feriado da lista. */
export function isHolidayDateKey(key: string) {
  return Object.prototype.hasOwnProperty.call(BUSINESS_HOLIDAYS, key);
}

/** True quando o instante cai num feriado no calendário de São Paulo. */
export function isHoliday(date: Date) {
  return isHolidayDateKey(saoPauloHolidayDateKey(date));
}

/** Dia útil: segunda a sexta e fora da lista de feriados. Recebe "YYYY-MM-DD". */
export function isBusinessDateKeyWithHolidays(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return weekday >= 1 && weekday <= 5 && !isHolidayDateKey(key);
}
