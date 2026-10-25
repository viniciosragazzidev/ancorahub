/** pt-BR formatting for the director dashboard preview. Numbers are always tabular in the CSS. */

const TIME_ZONE = "America/Sao_Paulo";
const integer = new Intl.NumberFormat("pt-BR");
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });
const shortDay = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" });

export const n = (value: number) => integer.format(value);
export const money = (value: number) => brl.format(value);

/** "12%" (no space), "0%" when there is nothing to divide. */
export function pct(part: number, whole: number) {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

/** A share already in 0 to 100 (one decimal), as the quality report stores it. */
export const share = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** "1 lead", "2 leads", "nenhum lead". */
export function plural(count: number, one: string, many: string, none?: string) {
  if (count === 0 && none) return none;
  return `${n(count)} ${count === 1 ? one : many}`;
}

/** Relative time up to a week ("há 4 min", "há 2 h", "ontem 18:03"), then dd/mm. */
export function arrival(value: string | Date, now: Date) {
  const date = new Date(value);
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  const time = timeFormat.format(date);
  if (minutes < 1) return { main: time, sub: "agora" };
  if (minutes < 60) return { main: time, sub: `há ${minutes} min` };
  if (dayKey.format(date) === dayKey.format(now)) return { main: time, sub: `há ${Math.round(minutes / 60)} h` };
  if (dayKey.format(date) === dayKey.format(new Date(now.getTime() - 86_400_000))) return { main: "Ontem", sub: time };
  return { main: shortDay.format(date), sub: time };
}

export function minutesLabel(minutes: number | null) {
  if (minutes === null) return "sem respostas ainda";
  if (minutes < 60) return `${n(minutes)} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

export function dateTitle(now: Date) {
  const label = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(now);
  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}

export function shortDate(value: string | Date) {
  return shortDay.format(new Date(value));
}

export const LEAD_STATUS: Record<string, { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  new: { label: "Novo", tone: "neutral" },
  distributed: { label: "Distribuído", tone: "neutral" },
  in_contact: { label: "Em atendimento", tone: "info" },
  quote_sent: { label: "Cotação enviada", tone: "info" },
  negotiation: { label: "Em negociação", tone: "info" },
  documentation_pending: { label: "Documentação pendente", tone: "warning" },
  under_analysis: { label: "Em análise", tone: "info" },
  converted: { label: "Convertido", tone: "success" },
  lost: { label: "Perdido", tone: "danger" },
};

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toLocaleUpperCase("pt-BR");
}

/** Período do painel em palavras: "hoje" ou "no período" (7, 30 dias ou intervalo). */
export function periodWords(period: unknown) {
  return period === "today" ? "hoje" : "no período";
}

/** Rótulo curto de um número que não dá para calcular (nunca "sem dados para sem dados"). */
export function noDataLabel(period: unknown) {
  return period === "today" ? "Sem dados hoje" : "Sem dados no período";
}

/** "24/10 07h" vira "07h" em "Hoje" (o dia da operação passa da meia-noite, mas o diretor lê só a hora). */
export function ranOutLabel(label: string, period: unknown) {
  return period === "today" ? label.split(" ").pop() ?? label : label;
}
