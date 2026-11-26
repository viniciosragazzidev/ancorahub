/**
 * Aviso de proposta aprovada ou recusada pela operadora (26/11/2026). Módulo puro: decide se avisa e monta o texto.
 * Só avisa quando o status muda para "aprovada" ou "perdida" (recusada); salvar de novo o mesmo status não avisa.
 * O texto com privacidade ligada vem de preferences-core (privatePushText), pelo tipo do aviso.
 */
import type { ProposalStatus } from "@/shared/db/schema";

export type ProposalOutcomeCapability = "proposal_approved" | "proposal_rejected";

export type ProposalOutcomeNotice = {
  capability: ProposalOutcomeCapability;
  type: string;
  title: string;
  message: string;
  idempotencyKey: string;
};

const OUTCOME: Partial<Record<ProposalStatus, { capability: ProposalOutcomeCapability; type: string; verb: string }>> = {
  aprovada: { capability: "proposal_approved", type: "proposal_approved", verb: "aprovada" },
  perdida: { capability: "proposal_rejected", type: "proposal_rejected", verb: "encerrada sem venda" },
};

export function buildProposalOutcomeNotice(input: {
  proposalId: string;
  previousStatus: ProposalStatus;
  newStatus: ProposalStatus;
  /** Quando o status anterior foi gravado: separa uma nova aprovação de um clique repetido na mesma mudança. */
  previousUpdatedAt: Date | string | null | undefined;
  leadName: string | null | undefined;
  operatorName: string | null | undefined;
}): ProposalOutcomeNotice | null {
  if (input.previousStatus === input.newStatus) return null;
  const outcome = OUTCOME[input.newStatus];
  if (!outcome) return null;
  const name = input.leadName?.trim() || "seu cliente";
  const operator = input.operatorName?.trim() || "operadora";
  const since = input.previousUpdatedAt ? new Date(input.previousUpdatedAt).getTime() : 0;
  // "Perdida" cobre recusa da operadora e desistência do cliente: o texto fica neutro, sem citar a operadora.
  const text = input.newStatus === "perdida" ? `Proposta de ${name} encerrada sem venda` : `Proposta de ${name} ${outcome.verb} pela ${operator}`;
  return {
    capability: outcome.capability,
    type: outcome.type,
    title: text,
    message: text,
    idempotencyKey: `proposal-outcome:${input.proposalId}:${input.newStatus}:${Number.isFinite(since) ? since : 0}`,
  };
}
