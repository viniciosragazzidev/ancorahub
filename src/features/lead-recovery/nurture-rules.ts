/**
 * Nutrição mensal (plano §5.1, segmentos R5/R6, fase 5), regras puras. Quem saiu da fila de ligação sem contato,
 * quem disse "agora não" (Momento ruim) e o perdido por preço ou momento há 60 dias recebem no máximo 3 toques,
 * um por mês, cada um com um motivo concreto (reajuste anual, troca de faixa de idade). Só template de marketing,
 * só Meta oficial. Respondeu: sai da nutrição e volta para a IA.
 */
import { saoPauloHour } from "@/features/qualification-turbo/approaches";

import { inRecoveryHours } from "./cadence-rules";
import { isRecoveryControl, type RecoverySettings } from "./settings-core";

export const NURTURE_TEMPLATE = "anc_n_reajuste";
export const NURTURE_MAX_TOUCHES = 3;
export const NURTURE_INTERVAL_DAYS = 30;
/** Perdido com este motivo volta para a nutrição depois de 60 dias (§4.3, N7). */
export const LOST_TO_NURTURE_DAYS = 60;
export const LOST_REASON_FOR_NURTURE = /pre[cç]o|caro|valor|momento|agora n[aã]o|depois|mais (pra|para) frente|sem dinheiro|or[cç]amento/i;

export type NurtureState = { state: "nurture" | "bad_moment"; at: Date; until: Date | null; touches: number };

export type NurtureDecision =
  | { action: "stop"; reason: "disabled" | "legal_pending" | "control" | "opted_out" | "assigned" }
  | { action: "replied" }
  | { action: "finished" }
  | { action: "wait"; reason: "not_yet" | "outside_hours" }
  | { action: "skip"; step: string; reason: "template_not_approved" | "marketing_blocked" }
  | { action: "send"; step: string; template: string };

export function decideNurtureTouch(input: {
  now: Date;
  settings: RecoverySettings;
  leadId: string;
  nurture: NurtureState;
  lastInboundAt: Date | null;
  optedOut: boolean;
  hasBroker: boolean;
  /** Só Utility aprovado (DEC-155). */
  approvedTemplates: ReadonlySet<string>;
  /** Aprovados de Marketing, barrados pela DEC-155. */
  marketingTemplates?: ReadonlySet<string>;
}): NurtureDecision {
  const { settings, now, nurture } = input;
  if (!settings.enabled || !settings.nurture) return { action: "stop", reason: "disabled" };
  if (!settings.legalReviewedAt) return { action: "stop", reason: "legal_pending" };
  if (isRecoveryControl(input.leadId, settings.controlPct)) return { action: "stop", reason: "control" };
  if (input.optedOut) return { action: "stop", reason: "opted_out" };
  if (input.lastInboundAt && input.lastInboundAt.getTime() > nurture.at.getTime()) return { action: "replied" };
  if (input.hasBroker) return { action: "stop", reason: "assigned" };
  if (nurture.touches >= NURTURE_MAX_TOUCHES) return { action: "finished" };
  if (nurture.until && nurture.until.getTime() > now.getTime()) return { action: "wait", reason: "not_yet" };
  const step = `n${nurture.touches + 1}`;
  if (!input.approvedTemplates.has(NURTURE_TEMPLATE)) return { action: "skip", step, reason: input.marketingTemplates?.has(NURTURE_TEMPLATE) ? "marketing_blocked" : "template_not_approved" };
  if (!inRecoveryHours(now, settings, input.lastInboundAt) || saoPauloHour(now) < 10) return { action: "wait", reason: "outside_hours" };
  return { action: "send", step, template: NURTURE_TEMPLATE };
}

/** Próxima data de nutrição depois de um toque (ou de um pulo). */
export function nextNurtureDate(now: Date) {
  return new Date(now.getTime() + NURTURE_INTERVAL_DAYS * 86_400_000);
}

/** Perdido que pode voltar para a nutrição: motivo de preço ou momento e 60 dias desde a perda. */
export function lostGoesToNurture(input: { status: string; lossReason: string | null; lostAt: Date | null; now: Date }) {
  if (input.status !== "lost" || !input.lostAt) return false;
  if (!LOST_REASON_FOR_NURTURE.test(input.lossReason ?? "")) return false;
  return input.now.getTime() - input.lostAt.getTime() >= LOST_TO_NURTURE_DAYS * 86_400_000;
}
