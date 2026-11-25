/**
 * Atalhos de "Nova tarefa" (inspirados nos planos de tarefa do DeskComm, versão pequena): um clique preenche
 * título e prazo com os próximos passos mais comuns da corretora. O usuário ainda edita antes de salvar.
 * Tudo é calculado no fuso America/Sao_Paulo, a partir de "agora". Prazo que cair no domingo vai para segunda.
 */

export const TASK_TIME_ZONE = "America/Sao_Paulo";

export type TaskPreset = {
  id: string;
  /** Texto do chip. */
  label: string;
  /** Título que vai para o campo. */
  title: string;
  /** Dias a partir de hoje (no fuso de São Paulo). */
  days: number;
  /** Hora fixa local (ex.: 9 para "amanhã 9h"). Sem ela, mantém a hora de agora. */
  hour?: number;
};

export const TASK_PRESETS: readonly TaskPreset[] = [
  { id: "ligar-amanha", label: "Ligar amanhã 9h", title: "Ligar para o cliente", days: 1, hour: 9 },
  { id: "cobrar-documentos", label: "Cobrar documentos em 2 dias", title: "Cobrar documentos", days: 2 },
  { id: "retornar-cotacao", label: "Retornar cotação em 3 dias", title: "Retornar cotação", days: 3 },
  { id: "confirmar-aprovacao", label: "Confirmar aprovação da operadora em 2 dias", title: "Confirmar aprovação da operadora", days: 2 },
  { id: "confirmar-carteirinha", label: "Confirmar carteirinha em 15 dias", title: "Confirmar carteirinha", days: 15 },
];

type WallClock = { year: number; month: number; day: number; hour: number; minute: number };

/** Data e hora de parede em São Paulo para um instante. */
function wallClockAt(instant: Date, timeZone = TASK_TIME_ZONE): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") % 24, minute: get("minute") };
}

/** Instante (UTC) de uma hora de parede em São Paulo. Corrige o deslocamento duas vezes para aguentar horário de verão. */
function instantFromWallClock(wall: WallClock, timeZone = TASK_TIME_ZONE): Date {
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  let guess = asUtc;
  for (let i = 0; i < 2; i += 1) {
    const seen = wallClockAt(new Date(guess), timeZone);
    const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    guess += asUtc - seenAsUtc;
  }
  return new Date(guess);
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Valor do campo datetime-local ("2026-11-26T09:00") na hora de São Paulo. */
export function toTaskLocalInput(instant: Date, timeZone = TASK_TIME_ZONE) {
  const wall = wallClockAt(instant, timeZone);
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}`;
}

/** Lê o campo datetime-local como hora de São Paulo e devolve o ISO para o servidor. Vazio ou inválido: null. */
export function taskLocalInputToIso(value: string, timeZone = TASK_TIME_ZONE): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  return instantFromWallClock({ year, month, day, hour, minute }, timeZone).toISOString();
}

/** Prazo do atalho a partir de `now`, em São Paulo. Domingo vira segunda, na mesma hora. */
export function computeTaskPresetDue(preset: TaskPreset, now: Date = new Date()): Date {
  const today = wallClockAt(now);
  const target = new Date(Date.UTC(today.year, today.month - 1, today.day + preset.days));
  if (target.getUTCDay() === 0) target.setUTCDate(target.getUTCDate() + 1);
  return instantFromWallClock({
    year: target.getUTCFullYear(),
    month: target.getUTCMonth() + 1,
    day: target.getUTCDate(),
    hour: preset.hour ?? today.hour,
    minute: preset.hour !== undefined ? 0 : today.minute,
  });
}

/** O que o atalho coloca no formulário: título e o valor do campo de prazo. */
export function applyTaskPreset(preset: TaskPreset, now: Date = new Date()) {
  return { title: preset.title, dueAt: toTaskLocalInput(computeTaskPresetDue(preset, now)) };
}
