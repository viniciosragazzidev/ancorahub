import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, ne, or } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

/**
 * Transitions a distributed lead to in_contact when its owning broker sends
 * the first message from the conversations surface (DEC-027: first contact may
 * happen either through the explicit start button or the first chat message).
 * The transition is conditional on status/corretorId so concurrent starts are
 * safe; returns false when nothing was transitioned.
 */
export async function startServiceOnFirstMessage(input: {
  tenantId: string;
  leadId: string;
  brokerId: string;
  branchId: string | null;
  trigger?: "button" | "first_message";
}): Promise<boolean> {
  const db = getDatabase();
  const now = new Date();

  const updated = await db.transaction(async (tx) => {
    const [currentLead] = await tx
      .select({ assignmentSource: schema.leads.assignmentSource })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.id, input.leadId),
        eq(schema.leads.tenantId, input.tenantId),
        eq(schema.leads.corretorId, input.brokerId),
        eq(schema.leads.status, "distributed"),
      ))
      .for("update")
      .limit(1);
    if (!currentLead) return false;

    const result = await tx
      .update(schema.leads)
      .set({
        status: "in_contact",
        stageEnteredAt: now,
        firstContactAt: now,
        serviceStartedAt: now,
        serviceStartedBy: input.brokerId,
        ...(currentLead.assignmentSource === "automatic_offer" || currentLead.assignmentSource === "manual_offer"
          ? { assignmentSource: "whatsapp_offer_accepted", assignmentStrategy: "whatsapp_offer" as const }
          : {}),
      })
      .where(
        and(
          eq(schema.leads.id, input.leadId),
          eq(schema.leads.tenantId, input.tenantId),
          eq(schema.leads.corretorId, input.brokerId),
          eq(schema.leads.status, "distributed"),
        ),
      )
      .returning({ id: schema.leads.id });

    if (!result.length) return false;

    const activeOffers = await tx
      .select({ id: schema.leadOffers.id, brokerId: schema.leadOffers.brokerId, outboundMessageId: schema.leadOffers.outboundMessageId })
      .from(schema.leadOffers)
      .where(and(
        eq(schema.leadOffers.tenantId, input.tenantId),
        eq(schema.leadOffers.leadId, input.leadId),
        inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
      ));

    await tx.update(schema.leadOffers)
      .set({ status: "ACCEPTED", acceptedAt: now, updatedAt: now })
      .where(and(
        eq(schema.leadOffers.tenantId, input.tenantId),
        eq(schema.leadOffers.leadId, input.leadId),
        eq(schema.leadOffers.brokerId, input.brokerId),
        inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
      ));

    await tx.update(schema.leadOffers)
      .set({ status: "LOST", updatedAt: now })
      .where(and(
        eq(schema.leadOffers.tenantId, input.tenantId),
        eq(schema.leadOffers.leadId, input.leadId),
        ne(schema.leadOffers.brokerId, input.brokerId),
        inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
      ));

    const obsoleteOutboxIds = activeOffers
      .filter((offer) => offer.brokerId !== input.brokerId && offer.outboundMessageId)
      .map((offer) => offer.outboundMessageId!);
    if (obsoleteOutboxIds.length) {
      await tx.update(schema.whatsappOutboundMessages)
        .set({ status: "cancelled", providerErrorCode: "OFFER_NO_LONGER_ACTIVE", providerErrorMessage: "Outro corretor iniciou o atendimento.", updatedAt: now })
        .where(and(
          eq(schema.whatsappOutboundMessages.tenantId, input.tenantId),
          inArray(schema.whatsappOutboundMessages.id, obsoleteOutboxIds),
          inArray(schema.whatsappOutboundMessages.status, ["queued", "pending"]),
        ));
    }

    const acceptedOffer = activeOffers.find((offer) => offer.brokerId === input.brokerId);
    if (acceptedOffer) {
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: input.brokerId,
        entidade: "lead_offer",
        entidadeId: acceptedOffer.id,
        acao: "lead_offer_accepted_by_starting_service",
        createdAt: now,
      });
    }

    await tx.update(schema.leadDistributionJobs)
      .set({ status: "completed", completedAt: now, lockedAt: null, lockedBy: null, leaseExpiresAt: null, lastErrorCode: null, lastErrorMessage: null, updatedAt: now })
      .where(and(
        eq(schema.leadDistributionJobs.tenantId, input.tenantId),
        eq(schema.leadDistributionJobs.leadId, input.leadId),
        inArray(schema.leadDistributionJobs.status, ["pending", "retrying", "processing"]),
      ));

    await tx
      .update(schema.leadAssignmentAttempts)
      .set({ status: "submitted", firstContactAt: now })
      .where(
        and(
          eq(schema.leadAssignmentAttempts.leadId, input.leadId),
          eq(schema.leadAssignmentAttempts.brokerId, input.brokerId),
          eq(schema.leadAssignmentAttempts.status, "open"),
        ),
      );

    await tx.insert(schema.leadInteractions).values({
      id: randomUUID(),
      leadId: input.leadId,
      userId: input.brokerId,
      tipo: "service_started",
      conteudo: input.trigger === "button"
        ? "Corretor iniciou o atendimento e os dados pessoais foram liberados."
        : "Atendimento iniciado automaticamente pela primeira mensagem enviada no chat.",
    });

    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: input.brokerId,
      entidade: "lead",
      entidadeId: input.leadId,
      acao: input.trigger === "button" ? "iniciou_atendimento_whatsapp" : "iniciou_atendimento_primeira_mensagem",
    });

    return true;
  });

  return updated;
}

/**
 * Supervisors entitled to the lead_service_started notification for a lead.
 * Kept here so the chat-triggered start can reuse the same audience as the
 * explicit start button.
 */
export function leadServiceStartedRecipientsScope(branchId: string | null) {
  return branchId
    ? or(eq(schema.tenantMemberships.role, "director"), eq(schema.tenantMemberships.branchId, branchId))
    : eq(schema.tenantMemberships.role, "director");
}
