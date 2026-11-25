/**
 * Tela /tarefas (25/11/2026, docs/research/deskcomm-crm-engenharia-reversa.md §7.2): regras puras de prazo no fuso
 * de São Paulo. Agrupa as tarefas abertas em Atrasadas, Hoje, Amanhã, Esta semana, Mais tarde e Sem prazo e escreve
 * o prazo de cada linha. Nada aqui decide permissão; a consulta escopada pela sessão entrega as linhas prontas.
 */

export const TASK_TIME_ZONE = "America/Sao_Paulo";

export type TaskDueGroupKey = "atrasadas" | "hoje" | "amanha" | "esta_semana" | "mais_tarde" | "sem_prazo";

export const TASK_DUE_GROUP_ORDER: readonly TaskDueGroupKey[] = ["atrasadas", "hoje", "amanha", "esta_semana", "mais_tarde", "sem_prazo"];

export const TASK_DUE_GROUP_LABELS: Record<TaskDueGroupKey, string> = {
  atrasadas: "Atrasadas",
  hoje: "Hoje",
  amanha: "Amanhã",
  esta_semana: "Esta semana",
  mais_tarde: "Mais tarde",
  sem_prazo: "Sem prazo",
};

/** Quem vê "Da equipe": diretor (empresa), gestor (unidade) e supervisor (equipe). O corretor vê só as suas. */
export function canSeeTeamTasks(role: string) {
  return role === "director" || role === "manager" || role === "supervisor";
}

type DueInput = Date | string | null | undefined;

function toDate(value: DueInput) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** yyyy-mm-dd no fuso de São Paulo (comparável como texto). */
export function saoPauloDay(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TASK_TIME_ZONE }).format(value);
}

function shiftDay(dayKey: string, amount: number) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

/** Domingo que fecha a semana de hoje (semana de segunda a domingo). Hoje domingo: o próprio dia. */
function endOfWeek(today: string) {
  const [year, month, day] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return shiftDay(today, (7 - weekday) % 7);
}

/**
 * Grupo de uma tarefa aberta. Atrasada é o prazo que já passou, mesmo hoje mais cedo (o retorno das 9h às 14h já
 * está atrasado). Depois de amanhã até domingo é "Esta semana"; além disso, "Mais tarde".
 */
export function taskDueGroupOf(dueAt: DueInput, now: Date): TaskDueGroupKey {
  const due = toDate(dueAt);
  if (!due) return "sem_prazo";
  if (due.getTime() < now.getTime()) return "atrasadas";
  const today = saoPauloDay(now);
  const day = saoPauloDay(due);
  if (day === today) return "hoje";
  const tomorrow = shiftDay(today, 1);
  if (day === tomorrow) return "amanha";
  if (day <= endOfWeek(today)) return "esta_semana";
  return "mais_tarde";
}

export type TaskDueGroup<T> = { key: TaskDueGroupKey; label: string; rows: T[] };

/** Grupos na ordem de leitura, só os que têm linhas; dentro de cada um, do prazo mais antigo ao mais novo. */
export function groupTasksByDue<T extends { id: string; dueAt: DueInput }>(rows: readonly T[], now: Date): TaskDueGroup<T>[] {
  const buckets = new Map<TaskDueGroupKey, T[]>();
  for (const row of rows) {
    const key = taskDueGroupOf(row.dueAt, now);
    const bucket = buckets.get(key) ?? [];
    bucket.push(row);
    buckets.set(key, bucket);
  }
  return TASK_DUE_GROUP_ORDER.flatMap((key) => {
    const bucket = buckets.get(key);
    if (!bucket?.length) return [];
    const sorted = [...bucket].sort((left, right) => {
      const leftTime = toDate(left.dueAt)?.getTime() ?? 0;
      const rightTime = toDate(right.dueAt)?.getTime() ?? 0;
      return leftTime - rightTime || left.id.localeCompare(right.id);
    });
    return [{ key, label: TASK_DUE_GROUP_LABELS[key], rows: sorted }];
  });
}

/** A tarefa aberta está atrasada agora? */
export function isTaskOverdue(dueAt: DueInput, now: Date) {
  const due = toDate(dueAt);
  return Boolean(due && due.getTime() < now.getTime());
}

/**
 * Prazo da linha, curto: "Hoje, 14:00", "Amanhã, 09:00", "Ontem, 10:00", "qua, 09:00" (nesta semana),
 * "20/11, 10:00" e o ano só quando é outro. Sem prazo: "Sem prazo".
 */
export function formatTaskDue(dueAt: DueInput, now: Date) {
  const due = toDate(dueAt);
  if (!due) return "Sem prazo";
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TASK_TIME_ZONE }).format(due);
  const today = saoPauloDay(now);
  const day = saoPauloDay(due);
  if (day === today) return `Hoje, ${time}`;
  if (day === shiftDay(today, 1)) return `Amanhã, ${time}`;
  if (day === shiftDay(today, -1)) return `Ontem, ${time}`;
  if (day > today && day <= endOfWeek(today)) {
    const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: TASK_TIME_ZONE }).format(due).replace(/\.$/, "");
    return `${weekday}, ${time}`;
  }
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", ...(sameYear ? {} : { year: "numeric" }), timeZone: TASK_TIME_ZONE }).format(due);
  return `${date}, ${time}`;
}
