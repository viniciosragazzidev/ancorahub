/**
 * Desfecho do fechamento (09/11, pedido do Vinicios): quando um lead sai de
 * Documentação ou Em análise por uma pessoa, a direção fica sabendo se fechou,
 * perdeu ou voltou de etapa. Lead parado no fechamento sem resposta vira
 * "desfecho pendente" para o corretor responder. Regras puras, sem I/O.
 */
import { CLOSING_STAGE_STATUSES } from "./closing-stage-notice-core";
import { LEAD_STATUS_LABELS, MOTIVO_PERDA_LABELS, type MotivoPerda } from "./lead-status-constants";

/** Dias corridos no fechamento sem mudança de etapa até virar "desfecho pendente". */
export const CLOSING_PENDING_DAYS = 10;
/** "Continua em análise": a data prevista vai até 60 dias à frente. */
export const CLOSING_HOLD_MAX_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Quem não é pessoa: regra de chat parado, sistema e IA nunca geram desfecho nem aviso. */
const NON_PERSON_ACTORS: ReadonlySet<string> = new Set(["rule", "system", "ai"]);

export function isPersonActor(actorType: string | null | undefined) {
  return Boolean(actorType) && !NON_PERSON_ACTORS.has(actorType!);
}

/** Sair do fechamento para fora dele; andar dentro dele (Documentação para Em análise) não é desfecho. */
export function leavesClosingStage(previousStatus: string | null | undefined, newStatus: string) {
  return Boolean(previousStatus) && CLOSING_STAGE_STATUSES.has(previousStatus!) && !CLOSING_STAGE_STATUSES.has(newStatus);
}

export type ClosingOutcomeKind = "converted" | "lost" | "returned";

export type ClosingOutcome = {
  kind: ClosingOutcomeKind;
  /** "Fechou", "Perdeu" ou "Voltou para <etapa>". */
  label: string;
  /** Motivo da perda, só quando perdeu. */
  lossLabel: string | null;
};

export function stageShortLabel(status: string) {
  const labels: Record<string, string> = {
    new: "Novo",
    distributed: "Distribuído",
    in_contact: "Em atendimento",
    quote_sent: "Cotação enviada",
    negotiation: "Negociação",
    awaiting_reply: "Aguardando retorno",
    documentation_pending: "Documentação",
    under_analysis: "Em análise",
  };
  return labels[status] ?? LEAD_STATUS_LABELS[status] ?? status;
}

export function lossReasonLabel(lossCode: string | null | undefined) {
  if (!lossCode) return null;
  return MOTIVO_PERDA_LABELS[lossCode as MotivoPerda] ?? lossCode;
}

export function classifyClosingOutcome(input: { toStatus: string; lossCode?: string | null }): ClosingOutcome {
  if (input.toStatus === "converted") return { kind: "converted", label: "Fechou", lossLabel: null };
  if (input.toStatus === "lost") return { kind: "lost", label: "Perdeu", lossLabel: lossReasonLabel(input.lossCode) ?? "Motivo não informado" };
  return { kind: "returned", label: `Voltou para ${stageShortLabel(input.toStatus)}`, lossLabel: null };
}

/** Dias corridos inteiros entre duas datas (nunca negativo). */
export function calendarDaysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

/** Uma notificação por diretor e por saída do fechamento: repetir a mesma mudança não avisa duas vezes. */
export function closingOutcomeNotificationKey(input: { leadId: string; changedAt: Date; recipientUserId: string }) {
  return `lead-closing-outcome:${input.leadId}:${input.changedAt.getTime()}:${input.recipientUserId}`;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function positiveNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Texto da notificação para a direção (sem travessão, curto para caber no push). */
export function closingOutcomeNotice(input: {
  leadName: string | null;
  brokerName: string | null;
  outcome: ClosingOutcome;
  value?: string | number | null;
  daysInClosing: number | null;
}) {
  const lead = input.leadName?.trim() || "Cliente";
  const broker = input.brokerName?.trim() || "sem corretor";
  const parts = [`Corretor: ${broker}`];
  if (input.outcome.kind === "converted") {
    const value = positiveNumber(input.value);
    if (value) parts.push(`Valor: ${brl.format(value)}/mês`);
  }
  if (input.outcome.kind === "lost" && input.outcome.lossLabel) parts.push(`Motivo: ${input.outcome.lossLabel}`);
  if (input.daysInClosing !== null) parts.push(input.daysInClosing === 1 ? "1 dia no fechamento" : `${input.daysInClosing} dias no fechamento`);
  const title = `Desfecho do fechamento: ${lead} ${input.outcome.kind === "returned" ? input.outcome.label.toLocaleLowerCase("pt-BR") : input.outcome.kind === "converted" ? "fechou" : "perdeu"}`;
  return {
    title,
    message: `${parts.join(". ")}.`,
    pushTitle: input.outcome.kind === "converted" ? "Fechamento: venda" : input.outcome.kind === "lost" ? "Fechamento: perdido" : "Fechamento: voltou de etapa",
    pushBody: `${lead}. ${parts.join(". ")}.`,
  };
}

export type PendingOutcome = {
  pending: boolean;
  /** Dias no fechamento desde a última mudança de etapa. */
  daysInClosing: number;
  /** "Continua em análise" ativo até esta data. */
  heldUntil: Date | null;
};

/**
 * Desfecho pendente: no fechamento há mais de 10 dias corridos sem mudança de etapa e sem uma data prevista
 * ainda no futuro ("Continua em análise").
 */
export function pendingClosingOutcome(input: {
  status: string;
  stageEnteredAt: Date | null;
  holdUntil: Date | null;
  now: Date;
}): PendingOutcome {
  if (!CLOSING_STAGE_STATUSES.has(input.status) || !input.stageEnteredAt) return { pending: false, daysInClosing: 0, heldUntil: null };
  const daysInClosing = calendarDaysBetween(input.stageEnteredAt, input.now);
  const heldUntil = input.holdUntil && input.holdUntil.getTime() > input.now.getTime() ? input.holdUntil : null;
  return { pending: daysInClosing > CLOSING_PENDING_DAYS && !heldUntil, daysInClosing, heldUntil };
}

/**
 * Data prevista do "Continua em análise" (AAAA-MM-DD, fim do dia em Brasília). Precisa ser a partir de amanhã
 * e no máximo 60 dias à frente.
 */
export function parseClosingHoldDate(raw: string, now: Date): { ok: true; until: Date } | { ok: false; reason: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) return { ok: false, reason: "Escolha a data prevista." };
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) {
    return { ok: false, reason: "Data inválida." };
  }
  // 23:59:59 em Brasília (UTC-3) do dia escolhido.
  const until = new Date(Date.UTC(year, month - 1, day, 23 + 3, 59, 59));
  const days = (until.getTime() - now.getTime()) / DAY_MS;
  if (days < 1) return { ok: false, reason: "A data prevista precisa ser a partir de amanhã." };
  if (days > CLOSING_HOLD_MAX_DAYS + 1) return { ok: false, reason: `A data prevista pode ser no máximo ${CLOSING_HOLD_MAX_DAYS} dias à frente.` };
  return { ok: true, until };
}

// ─── Agregação para a direção ─────────────────────────────────────────

/** Uma linha do histórico de etapas, com a etapa anterior já resolvida (a venda antiga gravava from_status vazio). */
export type ClosingTransitionRow = {
  leadId: string;
  brokerId: string | null;
  brokerName: string | null;
  fromStatus: string | null;
  toStatus: string;
  actorType: string;
};

export type OpenClosingLead = {
  brokerId: string | null;
  brokerName: string | null;
  pending: boolean;
};

export type ClosingOutcomeBrokerRow = {
  brokerId: string | null;
  brokerName: string;
  inClosing: number;
  pending: number;
  converted: number;
  lost: number;
  returned: number;
};

export type ClosingOutcomesSummary = {
  periodDays: number;
  entered: number;
  converted: number;
  lost: number;
  returned: number;
  pendingNow: number;
  inClosingNow: number;
  brokers: ClosingOutcomeBrokerRow[];
};

/** Contadores do período e a tabela por corretor. Só mudanças feitas por pessoas contam. */
export function summarizeClosingOutcomes(input: {
  periodDays: number;
  transitions: readonly ClosingTransitionRow[];
  openLeads: readonly OpenClosingLead[];
}): ClosingOutcomesSummary {
  const brokers = new Map<string, ClosingOutcomeBrokerRow>();
  const row = (brokerId: string | null, brokerName: string | null) => {
    const key = brokerId ?? "__none__";
    let current = brokers.get(key);
    if (!current) {
      current = { brokerId, brokerName: brokerName?.trim() || "Sem corretor", inClosing: 0, pending: 0, converted: 0, lost: 0, returned: 0 };
      brokers.set(key, current);
    }
    return current;
  };
  const summary: ClosingOutcomesSummary = { periodDays: input.periodDays, entered: 0, converted: 0, lost: 0, returned: 0, pendingNow: 0, inClosingNow: 0, brokers: [] };

  for (const transition of input.transitions) {
    if (!isPersonActor(transition.actorType)) continue;
    const fromClosing = Boolean(transition.fromStatus) && CLOSING_STAGE_STATUSES.has(transition.fromStatus!);
    const toClosing = CLOSING_STAGE_STATUSES.has(transition.toStatus);
    if (toClosing && !fromClosing) summary.entered += 1;
    if (!leavesClosingStage(transition.fromStatus, transition.toStatus)) continue;
    const outcome = classifyClosingOutcome({ toStatus: transition.toStatus });
    const broker = row(transition.brokerId, transition.brokerName);
    if (outcome.kind === "converted") { summary.converted += 1; broker.converted += 1; }
    else if (outcome.kind === "lost") { summary.lost += 1; broker.lost += 1; }
    else { summary.returned += 1; broker.returned += 1; }
  }

  for (const lead of input.openLeads) {
    const broker = row(lead.brokerId, lead.brokerName);
    broker.inClosing += 1;
    summary.inClosingNow += 1;
    if (lead.pending) { broker.pending += 1; summary.pendingNow += 1; }
  }

  summary.brokers = [...brokers.values()].sort((left, right) =>
    right.pending - left.pending || right.inClosing - left.inClosing || left.brokerName.localeCompare(right.brokerName, "pt-BR"));
  return summary;
}
