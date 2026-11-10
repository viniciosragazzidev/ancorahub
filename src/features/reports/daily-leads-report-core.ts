/**
 * Relatório das 18h (05/11, pedido do Vinicios): leads que entraram no dia em cada fila e quantos ficaram quentes,
 * mornos e frios. Regras puras; o envio fica em daily-leads-report.ts.
 */

export const DAILY_LEADS_REPORT_NOTICE_KEY = "DAILY_LEADS_REPORT";
export const DAILY_LEADS_REPORT_PURPOSE = "dailyLeadsReport";
/** Hora de São Paulo a partir da qual o relatório sai. */
export const DAILY_LEADS_REPORT_HOUR = 18;

export type QueueDayRow = { queueName: string | null; leads: number; hot: number; warm: number; cold: number };

const TIME_ZONE = "America/Sao_Paulo";

export function saoPauloDayKey(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

export function saoPauloHour(now: Date) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(now));
}

/** Sábado ou domingo em São Paulo: os relatórios do dia não saem (Vinicios, 10/11). */
export function isSaoPauloWeekend(now: Date) {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" }).format(now);
  return day === "Sat" || day === "Sun";
}

/** Meia-noite de hoje em São Paulo (UTC-3, sem horário de verão desde 2019). */
export function saoPauloDayStart(now: Date) {
  return new Date(`${saoPauloDayKey(now)}T03:00:00.000Z`);
}

export function shortDate(now: Date) {
  const key = saoPauloDayKey(now);
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function line(label: string, row: Pick<QueueDayRow, "leads" | "hot" | "warm" | "cold">) {
  const others = Math.max(0, row.leads - row.hot - row.warm - row.cold);
  const parts = [`🔥 ${plural(row.hot, "quente", "quentes")}`, `🌤️ ${plural(row.warm, "morno", "mornos")}`, `❄️ ${plural(row.cold, "frio", "frios")}`];
  if (others) parts.push(`${others} em qualificação`);
  return `*${label}*: ${plural(row.leads, "lead", "leads")} · ${parts.join(" · ")}`;
}

/** O texto do relatório: uma linha por fila (mais leads primeiro) e o total. */
export function buildDailyLeadsReport(rows: readonly QueueDayRow[]): string {
  const withLeads = rows.filter((row) => row.leads > 0).sort((a, b) => b.leads - a.leads || (a.queueName ?? "").localeCompare(b.queueName ?? "", "pt-BR"));
  if (!withLeads.length) return "Nenhum lead entrou hoje.";
  const total = withLeads.reduce((sum, row) => ({ leads: sum.leads + row.leads, hot: sum.hot + row.hot, warm: sum.warm + row.warm, cold: sum.cold + row.cold }), { leads: 0, hot: 0, warm: 0, cold: 0 });
  const lines = withLeads.map((row) => line(row.queueName?.trim() || "Sem fila", row));
  return withLeads.length > 1 ? `${lines.join("\n")}\n\n${line("Total", total)}` : lines[0];
}

export function dailyLeadsReportKey(tenantId: string, dayKey: string, phone: string) {
  return `daily-leads-report:${tenantId}:${dayKey}:${phone}`;
}
