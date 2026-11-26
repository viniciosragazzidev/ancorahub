import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { publishNotification } from "@/features/notifications/send-push-helper";
import type { ProposalStatus } from "@/shared/db/schema";
import { getDatabase, schema } from "@/shared/db";

import { buildProposalOutcomeNotice } from "./proposal-outcome-notice";

/**
 * Avisa o corretor responsável (sino + push) quando a proposta passa a aprovada ou recusada pela operadora.
 * Preferências (grupo "Proposta e documentos") e privacidade do push são aplicadas em publishNotification.
 * A chave de idempotência impede aviso dobrado se a mesma mudança for salva duas vezes.
 */
export async function notifyProposalOutcome(input: {
  tenantId: string;
  actorUserId: string;
  proposal: { id: string; leadId: string; quoteId: string | null; createdBy: string; status: ProposalStatus; updatedAt: Date | null; leadName?: string | null };
  newStatus: ProposalStatus;
}) {
  const { proposal } = input;
  if (proposal.status === input.newStatus || (input.newStatus !== "aprovada" && input.newStatus !== "perdida")) return false;
  const db = getDatabase();

  const [lead] = await db
    .select({ nome: schema.leads.nome, corretorId: schema.leads.corretorId, planId: schema.leads.planId })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, proposal.leadId), eq(schema.leads.tenantId, input.tenantId)))
    .limit(1);
  const recipientUserId = lead?.corretorId ?? proposal.createdBy;
  // Quem registrou o desfecho já sabe: não avisa a si mesmo.
  if (!recipientUserId || recipientUserId === input.actorUserId) return false;

  const [item] = proposal.quoteId
    ? await db
      .select({ planId: schema.quoteItems.planId })
      .from(schema.quoteItems)
      .where(eq(schema.quoteItems.quoteId, proposal.quoteId))
      .orderBy(desc(schema.quoteItems.recommended), asc(schema.quoteItems.createdAt))
      .limit(1)
    : [];
  const planId = item?.planId ?? lead?.planId ?? null;
  const [plan] = planId
    ? await db
      .select({ carrierName: schema.carriers.name })
      .from(schema.carrierPlans)
      .leftJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
      .where(eq(schema.carrierPlans.id, planId))
      .limit(1)
    : [];

  const notice = buildProposalOutcomeNotice({
    proposalId: proposal.id,
    previousStatus: proposal.status,
    newStatus: input.newStatus,
    previousUpdatedAt: proposal.updatedAt,
    leadName: lead?.nome ?? proposal.leadName,
    operatorName: plan?.carrierName ?? null,
  });
  if (!notice) return false;

  return publishNotification({
    capability: notice.capability,
    tenantId: input.tenantId,
    recipientUserId,
    leadId: proposal.leadId,
    type: notice.type,
    title: notice.title,
    message: notice.message,
    url: `/leads/${proposal.leadId}`,
    tag: `proposal-outcome-${proposal.id}`,
    idempotencyKey: notice.idempotencyKey,
  });
}
