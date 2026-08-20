"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { processQueuedLead } from "@/features/lead-distribution/service";

export type DeclineLeadState = { success?: boolean; error?: string };

export async function declineLeadAction(leadId: string, reason: string): Promise<DeclineLeadState> {
  if (!leadId) return { error: "ID do lead não fornecido." };

  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    const [lead] = await db
      .select({
        id: schema.leads.id,
        tenantId: schema.leads.tenantId,
        nome: schema.leads.nome,
        status: schema.leads.status,
        corretorId: schema.leads.corretorId,
        branchId: schema.leads.branchId,
      })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);

    if (!lead) return { error: "Lead não encontrado." };
    if (context.role !== "broker" || lead.corretorId !== context.userId) {
      return { error: "Somente o corretor responsável pode recusar este lead." };
    }

    if (lead.status !== "distributed" && lead.status !== "new") {
      return { error: "Este lead já foi assumido ou não está mais pendente de aceite." };
    }

    const now = new Date();

    const result = await db.transaction(async (tx) => {
      // 1. Update lead status back to distributed and clear corretorId
      const updated = await tx
        .update(schema.leads)
        .set({
          corretorId: null,
          status: "distributed",
          stageEnteredAt: now,
        })
        .where(
          and(
            eq(schema.leads.id, lead.id),
            eq(schema.leads.tenantId, context.tenantId),
            eq(schema.leads.corretorId, context.userId)
          )
        )
        .returning({ id: schema.leads.id });

      if (!updated.length) return false;

      // 2. Mark assignment attempt as released/declined
      await tx
        .update(schema.leadAssignmentAttempts)
        .set({
          status: "released",
          releasedAt: now,
          releaseReason: reason,
        })
        .where(
          and(
            eq(schema.leadAssignmentAttempts.leadId, lead.id),
            eq(schema.leadAssignmentAttempts.brokerId, context.userId),
            eq(schema.leadAssignmentAttempts.status, "open")
          )
        );

      // 3. Log interaction and audit log
      await tx.insert(schema.leadInteractions).values({
        id: randomUUID(),
        leadId: lead.id,
        userId: context.userId,
        tipo: "note",
        conteudo: `Corretor recusou o lead para redistribuição. Motivo: ${reason}`,
      });

      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "lead",
        entidadeId: lead.id,
        acao: "recusou_lead",
      });

      return true;
    });

    if (!result) {
      return { error: "Não foi possível recusar o lead. Verifique se o estado já foi alterado." };
    }

    // Attempt automatic redistribution in background
    void processQueuedLead(context, lead.id).catch(() => { /* Non-blocking */ });


    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível recusar o lead no momento." };
  }
}
