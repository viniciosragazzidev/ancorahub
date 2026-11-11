/**
 * Próxima ação da ficha do cliente no Corretor Lite (C2, 11/11). Regras puras, sem I/O.
 * Fonte: a tarefa aberta mais próxima do lead (lead_tasks). Sem tarefa aberta a ficha diz que não há retorno
 * agendado; nunca diz que o atendimento está "em dia" (BR-098).
 */

export const CARTEIRA_TIME_ZONE = "America/Sao_Paulo";
const DAY_MS = 86_400_000;
/** Janela em que uma repetição idêntica (duplo clique, retry) devolve a tarefa já criada. */
export const RETORNO_REPEAT_WINDOW_MS = 2 * 60_000;
/** Prazo máximo de um retorno agendado a partir de agora. */
export const RETORNO_MAX_DAYS_AHEAD = 365;

export type NextActionState = "none" | "overdue" | "today" | "upcoming";

export type NextActionView = {
  state: NextActionState;
  taskId: string | null;
  title: string | null;
  dueAt: string | null;
  reason: string;
};

const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: CARTEIRA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** Dia civil de São Paulo ("AAAA-MM-DD") de um instante. */
export function spDayKey(date: Date): string {
  return dayFormatter.format(date);
}

/** Dias civis inteiros de São Paulo entre dois instantes (positivo quando `to` é depois de `from`). */
export function spCalendarDaysBetween(from: Date, to: Date): number {
  const a = Date.parse(`${spDayKey(from)}T00:00:00Z`);
  const b = Date.parse(`${spDayKey(to)}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

/** Classifica a tarefa aberta mais próxima. `null` quer dizer que não há retorno agendado. */
export function classifyNextAction(task: { id: string; title: string; dueAt: Date | null } | null, now: Date): NextActionView {
  if (!task) {
    return { state: "none", taskId: null, title: null, dueAt: null, reason: "Nenhum retorno agendado para este cliente." };
  }
  const base = { taskId: task.id, title: task.title, dueAt: task.dueAt ? task.dueAt.toISOString() : null };
  if (!task.dueAt) {
    return { ...base, state: "upcoming", reason: "Retorno sem prazo definido." };
  }
  if (task.dueAt.getTime() < now.getTime() && spDayKey(task.dueAt) !== spDayKey(now)) {
    const days = Math.max(1, Math.abs(spCalendarDaysBetween(task.dueAt, now)));
    return { ...base, state: "overdue", reason: days === 1 ? "Retorno atrasado há 1 dia." : `Retorno atrasado há ${days} dias.` };
  }
  if (spDayKey(task.dueAt) === spDayKey(now)) {
    return { ...base, state: task.dueAt.getTime() < now.getTime() ? "overdue" : "today", reason: task.dueAt.getTime() < now.getTime() ? "Retorno atrasado de hoje." : "Retorno hoje." };
  }
  const days = spCalendarDaysBetween(now, task.dueAt);
  return { ...base, state: "upcoming", reason: days === 1 ? "Retorno amanhã." : `Retorno em ${days} dias.` };
}

/** Valida o prazo informado pelo corretor: data e hora válidas, no futuro e dentro da janela máxima. */
export function validateReturnDueAt(raw: string | null | undefined, now: Date): { ok: true; dueAt: Date } | { ok: false; reason: string } {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, reason: "Informe a data e a hora do retorno." };
  const dueAt = new Date(value);
  if (!Number.isFinite(dueAt.getTime())) return { ok: false, reason: "Data ou hora inválida." };
  if (dueAt.getTime() <= now.getTime()) return { ok: false, reason: "O retorno precisa ser em um horário futuro." };
  if (dueAt.getTime() > now.getTime() + RETORNO_MAX_DAYS_AHEAD * DAY_MS) return { ok: false, reason: `O retorno pode ser marcado até ${RETORNO_MAX_DAYS_AHEAD} dias à frente.` };
  return { ok: true, dueAt };
}

/**
 * Repetição do mesmo agendamento (duplo clique ou retry de rede): a tarefa aberta criada pelo mesmo usuário,
 * com o mesmo título e prazo, dentro da janela. Nesse caso não se cria outra.
 */
export function isRepeatedReturn(
  existing: { title: string; dueAt: Date | null; createdAt: Date; createdBy: string; completedAt: Date | null } | null | undefined,
  input: { title: string; dueAt: Date | null; userId: string },
  now: Date,
): boolean {
  if (!existing || existing.completedAt) return false;
  if (existing.createdBy !== input.userId || existing.title !== input.title) return false;
  if ((existing.dueAt?.getTime() ?? null) !== (input.dueAt?.getTime() ?? null)) return false;
  return now.getTime() - existing.createdAt.getTime() <= RETORNO_REPEAT_WINDOW_MS;
}
