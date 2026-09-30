import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, isNotNull, notInArray } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";

const ACTIVE_OFFER_STATUSES = ["PENDING", "SENT", "DELIVERED", "READ"];

/** Atomically claims an unassigned cold lead for qualification and stops its outstanding offers. */
export async function reopenColdLeadForQualification(input: { tenantId: string; leadId: string }) {
  const db = getDatabase();
  const now = new Date();
  const actorUserId = await resolveSystemUserId(input.tenantId);

  return db.transaction(async (tx) => {
    const [conversation] = await tx.select({
      id: schema.aiConversations.id,
      status: schema.aiConversations.status,
      optOutAt: schema.aiConversations.optOutAt,
      wrongNumberAt: schema.aiConversations.wrongNumberAt,
    }).from(schema.aiConversations).where(and(
      eq(schema.aiConversations.tenantId, input.tenantId),
      eq(schema.aiConversations.leadId, input.leadId),
    )).limit(1);
    if (conversation?.optOutAt || conversation?.wrongNumberAt || ["WAITING_HUMAN", "HUMAN_ACTIVE"].includes(conversation?.status ?? "")) return false;

    const [lead] = await tx.update(schema.leads).set({
      qualificationStatus: "qualifying",
      qualificationState: "IN_PROGRESS",
      status: "new",
      distributionStatus: "queued",
      distributionUpdatedAt: now,
      stageEnteredAt: now,
      updatedAt: now,
    }).where(and(
      eq(schema.leads.id, input.leadId),
      eq(schema.leads.tenantId, input.tenantId),
      eq(schema.leads.qualificationStatus, "cold"),
      inArray(schema.leads.qualificationState, ["QUALIFIED", "COMPLETED"]),
      isNotNull(schema.leads.qualificationCompletedAt),
      isNull(schema.leads.corretorId),
      notInArray(schema.leads.status, ["lost", "converted", "under_analysis"]),
      notInArray(schema.leads.distributionStatus, ["assigned", "manual_hold", "held", "removed", "returned_to_queue"]),
      isNull(schema.leads.distributionRemovedAt),
      isNull(schema.leads.archivedAt),
      isNull(schema.leads.deletedAt),
    )).returning({ id: schema.leads.id });
    if (!lead) return false;

    const activeOffers = await tx.select({ outboundMessageId: schema.leadOffers.outboundMessageId })
      .from(schema.leadOffers).where(and(
        eq(schema.leadOffers.tenantId, input.tenantId),
        eq(schema.leadOffers.leadId, input.leadId),
        inArray(schema.leadOffers.status, ACTIVE_OFFER_STATUSES),
      ));
    await tx.update(schema.leadOffers).set({ status: "CANCELLED", updatedAt: now }).where(and(
      eq(schema.leadOffers.tenantId, input.tenantId),
      eq(schema.leadOffers.leadId, input.leadId),
      inArray(schema.leadOffers.status, ACTIVE_OFFER_STATUSES),
    ));
    const offerMessageIds = activeOffers.flatMap((offer) => offer.outboundMessageId ? [offer.outboundMessageId] : []);
    if (offerMessageIds.length) {
      await tx.update(schema.whatsappOutboundMessages).set({
        status: "cancelled",
        providerErrorCode: "COLD_LEAD_REPLIED",
        providerErrorMessage: "O lead respondeu antes da atribuição; a oferta foi cancelada.",
        updatedAt: now,
      }).where(and(
        eq(schema.whatsappOutboundMessages.tenantId, input.tenantId),
        inArray(schema.whatsappOutboundMessages.id, offerMessageIds),
        inArray(schema.whatsappOutboundMessages.status, ["queued", "pending"]),
      ));
    }

    await tx.update(schema.whatsappOutboundMessages).set({
      status: "cancelled",
      providerErrorCode: "COLD_LEAD_REPLIED",
      providerErrorMessage: "O lead respondeu; o follow-up automático foi cancelado.",
      updatedAt: now,
    }).where(and(
      eq(schema.whatsappOutboundMessages.tenantId, input.tenantId),
      eq(schema.whatsappOutboundMessages.idempotencyKey, `cold-lead-reactivation:${input.leadId}`),
      inArray(schema.whatsappOutboundMessages.status, ["queued", "pending"]),
    ));

    if (conversation) {
      await tx.update(schema.aiConversations).set({
        status: "WAITING_CUSTOMER",
        automationState: "AI_ACTIVE",
        closedAt: null,
        lastActivityAt: now,
        updatedAt: now,
      }).where(and(
        eq(schema.aiConversations.id, conversation.id),
        eq(schema.aiConversations.tenantId, input.tenantId),
        isNull(schema.aiConversations.optOutAt),
        isNull(schema.aiConversations.wrongNumberAt),
      ));
    }

    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: actorUserId,
      entidade: "lead",
      entidadeId: input.leadId,
      acao: "cold_lead_reactivation.inbound_resumed",
      createdAt: now,
    });
    return true;
  });
}
