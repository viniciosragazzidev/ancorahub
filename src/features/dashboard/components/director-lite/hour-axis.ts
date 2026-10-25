/**
 * Eixo do gráfico "Hora a hora" no painel Lite. O relatório só traz as horas com movimento; aqui o eixo
 * vira contínuo (do início do dia da operação até agora, ou as 24 horas de um dia médio), com as horas
 * vazias marcadas para o gráfico desenhar só a linha de base. Puro: os testes conferem as bordas.
 */
import type { SimpleLeadQualityReportData } from "@/features/reports/metrics/lead-quality-service";

type Hour = SimpleLeadQualityReportData["hours"][number];
type Report = Pick<SimpleLeadQualityReportData, "hours" | "hourly" | "window" | "period">;

/** `future`: hora do dia de hoje que ainda não começou (o eixo de "Hoje" mostra o dia inteiro, das 19h às 18h). */
export type AxisHour = { key: string; label: string; good: number; weak: number; ranOut: boolean; empty: boolean; future: boolean; hour: Hour | null };

const HOUR = 3_600_000;
const TIME_ZONE = "America/Sao_Paulo";
const hourOnly = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" });
const dayHour = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", hour: "2-digit", hourCycle: "h23" });
/** Uma linha do tempo maior que isso volta a mostrar só as horas com movimento. */
const MAX_TIMELINE_HOURS = 48;

const weakOf = (split: Hour["arrived"]) => split.cold + split.noReply;

function toAxis(key: string, label: string, hour: Hour | null, future = false): AxisHour {
  const good = hour?.arrived.good ?? 0;
  const weak = hour ? weakOf(hour.arrived) : 0;
  const ranOut = Boolean(hour && hour.goodWaiting === 0 && weakOf(hour.distributed) > 0);
  return { key, label, good, weak, ranOut, empty: good + weak === 0, future, hour };
}

/** `now` vem do servidor (nunca Date.now no primeiro render); sem ele, o eixo termina na última hora com movimento. */
export function hourAxis(report: Report, now?: Date | null): AxisHour[] {
  if (report.hourly === "hour_of_day") {
    const byHour = new Map(report.hours.map((hour) => [hour.startsAt, hour]));
    return Array.from({ length: 24 }, (_, hour) => toAxis(String(hour), `${String(hour).padStart(2, "0")}h`, byHour.get(String(hour)) ?? null));
  }
  const since = new Date(report.window.since).getTime();
  const lastWithData = report.hours.length ? new Date(report.hours[report.hours.length - 1].startsAt).getTime() + HOUR : since;
  const until = report.window.until ? new Date(report.window.until).getTime() : null;
  const end = Math.max(lastWithData, until ?? now?.getTime() ?? lastWithData);
  const first = Math.floor(since / HOUR) * HOUR;
  // "Hoje" é o dia da operação inteiro (24 horas desde as 19h): poucas horas com dado ficam à esquerda, nunca esticadas.
  const count = Math.max(Math.ceil((end - first) / HOUR), report.period === "today" ? 24 : 0);
  if (!Number.isFinite(count) || count <= 0 || count > MAX_TIMELINE_HOURS) {
    return report.hours.map((hour) => toAxis(hour.startsAt, hour.label, hour));
  }
  const byStart = new Map(report.hours.map((hour) => [new Date(hour.startsAt).getTime(), hour]));
  const multiDay = report.hours.some((hour) => hour.label.includes("/"));
  return Array.from({ length: count }, (_, index) => {
    const start = first + index * HOUR;
    const date = new Date(start);
    const label = multiDay ? `${dayHour.format(date).replace(", ", " ")}h` : `${hourOnly.format(date)}h`;
    const reference = now?.getTime() ?? until ?? lastWithData;
    // "Hoje" mostra só a hora ("19h"), mesmo quando o dia da operação passa da meia-noite.
    const text = report.period === "today" ? `${hourOnly.format(date)}h` : byStart.get(start)?.label ?? label;
    return toAxis(date.toISOString(), text, byStart.get(start) ?? null, start >= reference);
  });
}

/** De quantas em quantas horas o eixo mostra o rótulo (sem sobrepor no celular). */
export function tickEvery(count: number) {
  if (count <= 8) return 1;
  if (count <= 16) return 2;
  return 3;
}
