/**
 * "Onde está agora" na gaveta do lead (Leads na qualificação, engenharia reversa §7.3), regras puras.
 * Lê a cadência que vale para o lead (turbo T1–T4 para quem nunca respondeu; S2–S6 para quem parou no meio; W2–W3
 * para o morno) e diz o passo atual, o próximo toque com data e o que dá para fazer (pausar, pular, encerrar).
 * Nada aqui manda mensagem.
 */
import { CADENCE } from "@/features/qualification-turbo/cadence";

import { RECOVERY_STEPS } from "./cadence-rules";

export type RecoveryPositionSegment = "never_replied" | "stopped_midway" | "warm";

export type RecoveryPositionTouch = { step: string; status: string; at: Date | string };

export type RecoveryPositionInput = {
  now: Date;
  segment: RecoveryPositionSegment | null;
  /** Início da contagem: 1º contato do turbo, última pergunta da IA (R2) ou atribuição ao corretor (morno). */
  startAt: Date | string | null;
  touches: readonly RecoveryPositionTouch[];
  /** `qualification_details.recovery` do lead. */
  recovery: Record<string, unknown> | null;
  /** O turbo já parou para este lead (qualification_details.turbo.stoppedAt). */
  turboStoppedAt?: string | null;
  /** A cadência deste segmento está ligada na empresa (sem isso nada sai, mesmo com passo previsto). */
  running: boolean;
};

export type RecoveryPositionState = "active" | "paused" | "finished" | "marked" | "off" | "none";

export type RecoveryPosition = {
  state: RecoveryPositionState;
  /** Frase curta do estado ("Pausada", "Encerrada", "Fila de ligação"). */
  label: string;
  segment: RecoveryPositionSegment | null;
  /** Último passo feito (enviado ou pulado). */
  current: { step: string; label: string; status: string } | null;
  /** Próximo toque previsto. `at` no passado quer dizer "no próximo horário permitido". */
  next: { step: string; label: string; at: string } | null;
  done: number;
  total: number;
  canPause: boolean;
  canResume: boolean;
  canSkip: boolean;
  canFinish: boolean;
};

const STEP_LABEL: Record<string, string> = {
  t1: "Lembrete de 20 minutos",
  t2: "Lembrete de 3 horas",
  t3: "Pedido de ligação no dia seguinte",
  t4: "Despedida depois de 3 dias",
  s2: "Retomada depois de 3 horas",
  s3: "Oferta de simulação no dia seguinte",
  s4: "Cotação depois de 2 dias",
  s5: "Pedido de ligação depois de 4 dias",
  s6: "Despedida depois de 7 dias",
  w2: "Ponte com o corretor depois de 2 horas",
  w3: "Ponte com o corretor no dia seguinte",
};

export function recoveryStepLabel(step: string) {
  return STEP_LABEL[step] ?? step;
}

/** Passos da cadência do segmento, na ordem, com o atraso a partir do início. */
export function stepsForSegment(segment: RecoveryPositionSegment): Array<{ step: string; afterMinutes: number }> {
  if (segment === "never_replied") return CADENCE.map((step) => ({ step: step.touch, afterMinutes: step.afterMinutes }));
  return RECOVERY_STEPS.filter((step) => step.segment === segment).map((step) => ({ step: step.id, afterMinutes: step.afterMinutes }));
}

/** Etapa da jornada → segmento da cadência (R1 nunca respondeu, R2 parou no meio, R3 morno). */
export function segmentForJourney(code: string): RecoveryPositionSegment | null {
  if (code === "R1") return "never_replied";
  if (code === "R2") return "stopped_midway";
  if (code === "R3") return "warm";
  return null;
}

const MARK_LABEL: Record<string, string> = {
  call_queue: "Na fila de ligação",
  bad_moment: "Momento ruim, volta depois",
  nurture: "Em nutrição",
  do_not_contact: "Não contatar",
};

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Um passo conta como feito quando saiu, foi pulado ou falhou de vez (o mesmo critério das cadências). */
function isDone(touch: RecoveryPositionTouch) {
  return touch.status === "sent" || touch.status === "skipped" || touch.status === "failed";
}

export function describeRecoveryPosition(input: RecoveryPositionInput): RecoveryPosition {
  const recovery = input.recovery ?? {};
  const state = typeof recovery.state === "string" ? recovery.state : null;
  const segment = input.segment;
  const steps = segment ? stepsForSegment(segment) : [];
  const doneSteps = new Set(input.touches.filter(isDone).map((touch) => touch.step));
  const lastDone = [...input.touches].filter((touch) => isDone(touch) && steps.some((step) => step.step === touch.step))
    .sort((a, b) => (toDate(a.at)?.getTime() ?? 0) - (toDate(b.at)?.getTime() ?? 0)).pop() ?? null;
  const current = lastDone ? { step: lastDone.step, label: recoveryStepLabel(lastDone.step), status: lastDone.status } : null;
  const done = steps.filter((step) => doneSteps.has(step.step)).length;
  const base = { segment, current, done, total: steps.length };
  const closed = { canPause: false, canResume: false, canSkip: false, canFinish: false };

  if (state === "paused") {
    return { ...base, ...closed, state: "paused", label: "Pausada", next: null, canResume: true, canFinish: true };
  }
  if (state && MARK_LABEL[state]) {
    return { ...base, ...closed, state: "marked", label: MARK_LABEL[state], next: null };
  }
  if (recovery.cadenceFinishedAt || input.turboStoppedAt) {
    return { ...base, ...closed, state: "finished", label: recovery.finishedBy ? "Encerrada pela equipe" : "Encerrada", next: null };
  }
  if (!segment) {
    return { ...base, ...closed, state: "none", label: "Fora da recuperação", next: null };
  }

  const nextStep = steps.find((step) => !doneSteps.has(step.step)) ?? null;
  const startAt = toDate(input.startAt);
  if (!nextStep) {
    return { ...base, ...closed, state: "finished", label: "Todos os toques já saíram", next: null };
  }
  const next = startAt ? { step: nextStep.step, label: recoveryStepLabel(nextStep.step), at: new Date(startAt.getTime() + nextStep.afterMinutes * 60_000).toISOString() } : null;
  const actions = { canPause: true, canResume: false, canSkip: Boolean(next), canFinish: true };
  if (!input.running) return { ...base, ...actions, state: "off", label: "Recuperação desligada na empresa", next };
  return { ...base, ...actions, state: "active", label: `Passo ${Math.min(done + 1, steps.length)} de ${steps.length}`, next };
}

/** Quando sai o próximo toque, em palavras ("hoje às 14:30", "no próximo horário permitido"). */
export function formatNextTouch(at: string, now: Date) {
  const date = new Date(at);
  if (date.getTime() <= now.getTime()) return "no próximo horário permitido";
  const day = (value: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(value);
  const time = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(date);
  if (day(date) === day(now)) return `hoje às ${time}`;
  if (day(date) === day(new Date(now.getTime() + 86_400_000))) return `amanhã às ${time}`;
  return `${day(date)} às ${time}`;
}

/** Quem pode agir na recuperação de um lead: diretor na empresa, gestor na unidade, supervisor na equipe. */
export type RecoveryActionScope = "tenant" | "branch" | "team" | "unassigned";

export function recoveryActionScopeFor(role: string | null | undefined): RecoveryActionScope {
  if (role === "director") return "tenant";
  if (role === "manager") return "branch";
  if (role === "supervisor") return "team";
  // Cargo de marketing (sem papel de gestão): só leads ainda sem corretor, que são os da qualificação.
  return "unassigned";
}
