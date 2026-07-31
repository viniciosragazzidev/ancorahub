/**
 * Helpers compartilhados para montar séries de tendência (sparklines)
 * a partir de datas reais de entidades. Usado nas rotas que exibem
 * cards de indicadores no topo.
 */

function toDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/**
 * Chave de dia (YYYY-MM-DD) no fuso America/Sao_Paulo.
 * Deve casar com `date_trunc('day', ... AT TIME ZONE 'America/Sao_Paulo')::date::text`
 * usado nas queries diárias, evitando o mismatch de UTC × horário local.
 */
export function brazilDayKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Últimos N meses com a contagem de ocorrências por mês (mais antigo → hoje).
 */
export function monthlyCounts(
  dates: Array<Date | string>,
  months = 6,
): number[] {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const counts = new Array<number>(months).fill(0);
  for (const raw of dates) {
    const d = toDate(raw);
    const diff =
      (d.getFullYear() - startMonth.getFullYear()) * 12 +
      (d.getMonth() - startMonth.getMonth());
    if (diff >= 0 && diff < months) counts[diff] += 1;
  }
  return counts;
}

/**
 * Últimos N meses somando `value` por mês (mais antigo → hoje).
 */
export function monthlySums(
  entries: Array<{ date: Date | string; value: number }>,
  months = 6,
): number[] {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const sums = new Array<number>(months).fill(0);
  for (const entry of entries) {
    const d = toDate(entry.date);
    const diff =
      (d.getFullYear() - startMonth.getFullYear()) * 12 +
      (d.getMonth() - startMonth.getMonth());
    if (diff >= 0 && diff < months) sums[diff] += entry.value;
  }
  return sums;
}

/**
 * Últimos N dias com a contagem de ocorrências por dia (mais antigo → hoje).
 */
export function dailyCounts(
  dates: Array<Date | string>,
  days = 7,
): number[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const counts = new Array<number>(days).fill(0);
  for (const raw of dates) {
    const d = toDate(raw);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.floor((now.getTime() - dayStart) / 86_400_000);
    if (diffDays >= 0 && diffDays < days) counts[days - 1 - diffDays] += 1;
  }
  return counts;
}

/**
 * Soma acumulada de uma série (progressão cumulativa).
 */
export function cumulative(values: number[]): number[] {
  let acc = 0;
  return values.map((value) => (acc += value));
}
