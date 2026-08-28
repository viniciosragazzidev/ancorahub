import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";

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
}): Promise<boolean> {
  const db = getDatabase();
  const now = new Date();

  const updated = await db.transaction(async (tx) => {
    const result = await tx
      .update(schema.leads)
      .set({
        status: "in_contact",
        stageEnteredAt: now,
        firstContactAt: now,
        serviceStartedAt: now,
        serviceStartedBy: input.brokerId,
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
      conteudo: "Atendimento iniciado automaticamente pela primeira mensagem enviada no chat.",
    });

    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: input.brokerId,
      entidade: "lead",
      entidadeId: input.leadId,
      acao: "iniciou_atendimento_primeira_mensagem",
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
