"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasCapability } from "@/shared/auth/permissions";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import { chooseAvailableBroker } from "@/features/leads/assignment";
import { notifyNewLead, notifyLeadArrived } from "@/features/notifications/send-push-helper";
import { enqueueLeadDistributionJob } from "@/features/lead-distribution/jobs";

export async function forceCompleteQualificationAction(input: {
  leadId: string;
  targetQueueId?: string | null;
}) {
  try {
    const context = await getRequiredTenantContext();
    if (
      !hasCapability(context.role, "acessar_leads", context.jobTitle) &&
      !hasCapability(context.role, "acessar_qualificacao_ia", context.jobTitle)
    ) {
      throw new AuthorizationError("Seu perfil não pode gerenciar a qualificação de leads.");
    }

    const db = getDatabase();

    const [lead] = await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        branchId: schema.leads.branchId,
        queueId: schema.leads.queueId,
        qualificationStatus: schema.leads.qualificationStatus,
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.id, input.leadId),
          eq(schema.leads.tenantId, context.tenantId)
        )
      )
      .limit(1);

    if (!lead) {
      return { success: false, error: "Lead não encontrado." };
    }

    const finalQueueId = input.targetQueueId !== undefined ? input.targetQueueId : lead.queueId;
    const branchId = lead.branchId || context.branchId;

    if (!branchId) {
      return { success: false, error: "O lead precisa ter uma unidade vinculada para ser distribuído." };
    }

    const brokerId = await chooseAvailableBroker(context.tenantId, branchId);
    const assigned = Boolean(brokerId);
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(schema.leads)
        .set({
          qualificationStatus: "qualified",
          qualificationState: "QUALIFIED",
          qualificationCompletedAt: now,
          status: assigned ? "distributed" : "new",
          distributionStatus: assigned ? "assigned" : "queued",
          corretorId: brokerId,
          queueId: finalQueueId,
          assignmentSource: assigned ? "manual_override" : null,
          assignmentStrategy: assigned ? "capacity" : null,
          distributionUpdatedAt: now,
          assignedAt: assigned ? now : null,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.leads.id, lead.id),
            eq(schema.leads.tenantId, context.tenantId)
          )
        );

      await tx.insert(schema.leadInteractions).values({
        id: randomUUID(),
        leadId: lead.id,
        userId: context.userId,
        tipo: "system_alert",
        conteudo: "Qualificação forçada manualmente. Lead aprovado e enviado para a fila de distribuição.",
      });

      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "lead",
        entidadeId: lead.id,
        acao: "qualification.manually_completed",
      });
    });

    void notifyLeadArrived(lead.id, context.tenantId, branchId, lead.nome).catch(console.error);
    if (brokerId) {
      void notifyNewLead(lead.id, context.tenantId, branchId, brokerId, lead.nome).catch(console.error);
    } else {
      void enqueueLeadDistributionJob({ tenantId: context.tenantId, leadId: lead.id }).catch(console.error);
    }

    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível concluir a qualificação do lead.",
    };
  }
}

export async function updateLeadTargetQueueAction(input: {
  leadId: string;
  queueId: string | null;
}) {
  try {
    const context = await getRequiredTenantContext();
    if (
      !hasCapability(context.role, "acessar_leads", context.jobTitle) &&
      !hasCapability(context.role, "acessar_qualificacao_ia", context.jobTitle)
    ) {
      throw new AuthorizationError("Seu perfil não pode alterar a fila de destino do lead.");
    }

    const db = getDatabase();

    await db
      .update(schema.leads)
      .set({
        queueId: input.queueId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.leads.id, input.leadId),
          eq(schema.leads.tenantId, context.tenantId)
        )
      );

    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "lead",
      entidadeId: input.leadId,
      acao: "qualification.target_queue_updated",
    });

    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível alterar a fila de destino do lead.",
    };
  }
}
