import { gte, sql } from "drizzle-orm";

/**
 * Período granular compartilhado pelas rotas de dados.
 *
 * O seletor 7/14/30/90 é persistido na URL como `?period=N`. Todas as janelas
 * agregadas (all-time, 7d, 30d, 6 meses, mês atual) passam a ser governadas
 * por ele; janelas operacionais (hoje/ontem, SLA) permanecem fixas nas queries.
 *
 * `periodStart` e `fillTrendDays` devem ser usados em conjunto para que o offset
 * SQL e o preenchimento das séries usem a mesma janela.
 */

export const PERIOD_OPTIONS = [7, 14, 30, 90] as const;
export type PeriodValue = (typeof PERIOD_OPTIONS)[number];

export const DEFAULT_PERIOD: PeriodValue = 30;

const PERIOD_SET = new Set<number>(PERIOD_OPTIONS);

/**
 * Valida entrada externa de `?period=` contra a whitelist. Qualquer valor fora
 * dela (ou ausente) cai no fallback — nunca propaga input do cliente.
 */
export function parsePeriod(raw: unknown, fallback: PeriodValue = DEFAULT_PERIOD): PeriodValue {
  if (typeof raw !== "string") return fallback;
  const num = Number.parseInt(raw, 10);
  return PERIOD_SET.has(num) ? (num as PeriodValue) : fallback;
}

/**
 * Início do período (N dias atrás, no início do dia local). Usado nos filtros
 * `gte(createdAt, periodStart(period))` das queries de dados.
 */
export function periodStart(days: PeriodValue, now: Date = new Date()): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - (days - 1));
  return start;
}

/**
 * Expressão SQL `now() - ((N-1) * interval '1 day')` para as queries com data no
 * banco. Usa `days - 1` para casar com `periodStart`/`fillTrendDays`: uma série de
 * N pontos (loop `days-1..0`) cobre do início do dia N-1 até hoje — mesmo padrão
 * que o `interval '29 days'` de 30 pontos já usado no dashboard.
 */
export function periodDaysAgoSql(days: PeriodValue) {
  return sql`now() - (${days - 1} * interval '1 day')`;
}

export type TrendPoint<T extends { date: string }> = {
  date: string;
} & Omit<T, "date">;

/**
 * Preenche a série dos últimos N dias (mais antigo → hoje) usando as chaves
 * `YYYY-MM-DD` retornadas pelo banco. Dias sem ocorrência entram zerados.
 * Mesma janela de `periodStart`.
 */
export function fillTrendDays<T extends { date: string }>(
  days: PeriodValue,
  dateMap: Map<string, T>,
  now: Date = new Date(),
): TrendPoint<T>[] {
  const points: TrendPoint<T>[] = [];
  let schemaKeys: string[] | null = null;
  if (dateMap.size > 0) {
    const first = dateMap.values().next().value as T | undefined;
    if (first) schemaKeys = Object.keys(first).filter((k) => k !== "date");
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const existing = dateMap.get(key);
    const point = { date: key } as unknown as TrendPoint<T>;
    if (schemaKeys) {
      for (const k of schemaKeys) {
        (point as unknown as Record<string, number | undefined>)[k] =
          (existing as unknown as Record<string, number | undefined> | undefined)?.[k] ?? 0;
      }
    }
    points.push(point);
  }
  return points;
}

/**
 * Condição `gte(coluna, now() - N dias)` montada com o operador drizzle importado.
 */
export function gtePeriod(col: Parameters<typeof gte>[0], days: PeriodValue) {
  return gte(col, periodDaysAgoSql(days));
}

export function periodLabel(days: PeriodValue): string {
  return `Últimos ${days} dias`;
}
