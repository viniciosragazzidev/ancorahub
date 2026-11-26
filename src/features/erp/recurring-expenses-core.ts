/**
 * Regras puras da despesa que se repete todo mês (aluguel, internet, leads comprados, salários fixos).
 * Sem banco e sem sessão: o serviço (`recurring-expenses.ts`) lê as regras e grava o que este plano devolver.
 */

/** Quantos meses atrasados uma abertura de tela gera de uma vez; o restante sai na próxima. */
export const RECURRING_CATCH_UP_LIMIT = 12;

const COMPETENCE = /^(\d{4})-(0[1-9]|1[0-2])$/;

function parts(competence: string) {
  const match = COMPETENCE.exec(competence);
  if (!match) throw new Error(`Competência inválida: ${competence}`);
  return { year: Number(match[1]), month: Number(match[2]) };
}

/** `2026-11` + 2 = `2027-01`. */
export function addMonths(competence: string, months: number) {
  const { year, month } = parts(competence);
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function monthsBetween(from: string, to: string) {
  const a = parts(from); const b = parts(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

/** Competência do dia em São Paulo: é o mês que "virou" para quem usa a tela. */
export function competenceOf(now: Date) {
  const values = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "America/Sao_Paulo" }).formatToParts(now);
  const year = values.find((part) => part.type === "year")?.value; const month = values.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

/** Vencimento no mês alvo: mesmo dia da origem, limitado ao último dia do mês (31 vira 28/29/30). */
export function shiftDueOn(originDueOn: string, months: number) {
  const [year, month, day] = originDueOn.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12); const targetMonth = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

/** Referência do mês gerado: a da origem com a competência no fim, sempre dentro dos 100 caracteres. */
export function recurringReference(originReference: string, competence: string) {
  const suffix = `:${competence}`;
  return `${originReference.slice(0, 100 - suffix.length)}${suffix}`;
}

/** Primeiro mês que a regra gera: o seguinte ao da origem, nunca antes do mês em que a repetição foi ligada. */
export function firstRecurringCompetence(originCompetence: string, current: string) {
  const next = addMonths(originCompetence, 1);
  return monthsBetween(next, current) > 0 ? current : next;
}

export type RecurringRule = { id: string; status: string; startsCompetence: string };
export type RecurringOrigin = { reference: string; competence: string; dueOn: string; status: string };
export type RecurringPlanItem = { competence: string; dueOn: string; reference: string };

/**
 * Meses que ainda faltam gerar até o mês atual. Idempotente: um mês já gerado (ou fechado) nunca volta ao plano,
 * então abrir a tela duas vezes não cria despesa duplicada. Regra parada ou origem rejeitada não gera nada.
 */
export function planRecurringExpenses({ rule, origin, generated, closed = new Set(), current, limit = RECURRING_CATCH_UP_LIMIT }: {
  rule: RecurringRule; origin: RecurringOrigin; generated: ReadonlySet<string>; closed?: ReadonlySet<string>; current: string; limit?: number;
}): RecurringPlanItem[] {
  if (rule.status !== "active" || origin.status === "rejected") return [];
  const plan: RecurringPlanItem[] = [];
  for (let competence = rule.startsCompetence; monthsBetween(competence, current) >= 0 && plan.length < limit; competence = addMonths(competence, 1)) {
    if (monthsBetween(origin.competence, competence) <= 0) continue;
    if (generated.has(competence) || closed.has(competence)) continue;
    plan.push({ competence, dueOn: shiftDueOn(origin.dueOn, monthsBetween(origin.competence, competence)), reference: recurringReference(origin.reference, competence) });
  }
  return plan;
}

/** Só despesa não rejeitada pode passar a se repetir. */
export function canRepeatMonthly(row: { kind: string; status: string }) {
  return row.kind === "expense" && row.status !== "rejected";
}

/** Ação do `⋯` da linha: "Parar de repetir" na série, "Repetir todo mês" na despesa avulsa, nada no resto. */
export function recurringRowAction(row: { kind: string; status: string; recurring: boolean }): "stop" | "start" | null {
  if (row.recurring) return "stop";
  return canRepeatMonthly(row) ? "start" : null;
}
