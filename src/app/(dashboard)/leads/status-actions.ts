"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { changeLeadStatus, type ChangeLeadStatusInput } from "@/features/leads/change-lead-status";
import { assignLeadToBroker } from "@/features/lead-distribution/service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { publishLeadInvalidation } from "@/features/leads/publish-lead-invalidation";
import { scheduleAfterResponse } from "@/shared/async/after-response";
import { runLeadEffectOutboxProcessor } from "@/features/leads/webhooks/services/lead-effect-outbox";
import { processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";

export type StatusChangeState = {
  success?: boolean;
  error?: string;
  message?: string;
  mutationId?: string;
  changedLeadIds?: string[];
  newStatus?: string;
};

// ─── Bulk reassign leads to a broker ────────────────────────────

export type BulkReassignState = {
  success?: boolean;
  error?: string;
  message?: string;
  mutationId?: string;
  changedLeadIds?: string[];
  brokerId?: string;
};

export async function bulkReassignLeadsAction(
  _previous: BulkReassignState,
  formData: FormData,
): Promise<BulkReassignState> {
  const mutationId = randomUUID();
  const parsed = z.object({
    leadIds: z.array(z.string().uuid()).min(1),
    brokerId: z.string().uuid(),
  }).safeParse({ leadIds: formData.getAll("leadIds"), brokerId: formData.get("brokerId") });

  if (!parsed.success) return { mutationId, error: "Selecione leads e um corretor válidos." };
  const { leadIds, brokerId } = parsed.data;

  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") {
      return { mutationId, error: "Apenas diretores e gestores podem reatribuir leads." };
    }

    const source = context.role === "director" ? "manual_director" : "manual_manager";
    let successCount = 0;
    let errorCount = 0;
    let lastError = "";
    const changedLeadIds: string[] = [];
    const affectedLeads = await getDatabase()
      .select({ id: schema.leads.id, branchId: schema.leads.branchId, corretorId: schema.leads.corretorId })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.id, leadIds)));

    for (const leadId of leadIds) {
      try {
        const result = await assignLeadToBroker(
          context,
          leadId,
          brokerId,
          source,
          "Reatribuição em lote",
        );
        if (result.status === "assigned") {
          successCount++;
          changedLeadIds.push(leadId);
          if (result.notificationWarnings?.length) {
            lastError = `Notificação: ${result.notificationWarnings.join("; ")}`;
          }
        } else {
          errorCount++;
          lastError = result.reason;
        }
      } catch (error) {
        errorCount++;
        lastError = error instanceof Error ? error.message : "Erro desconhecido";
      }
    }

    if (changedLeadIds.length) {
      const changedLeadIdSet = new Set(changedLeadIds);
      const changedLeads = affectedLeads.filter((lead) => changedLeadIdSet.has(lead.id));
      void publishLeadInvalidation({
        tenantId: context.tenantId,
        actorId: context.userId,
        branchIds: changedLeads.map((lead) => lead.branchId),
        brokerIds: [brokerId, ...changedLeads.map((lead) => lead.corretorId)],
      }).catch(() => undefined);

      scheduleAfterResponse("lead-reassign-batch-effects", async () => {
        await runLeadEffectOutboxProcessor({
          tenantId: context.tenantId,
          limit: Math.max(changedLeadIds.length * 2, 10),
        });
        await processMetaOutboundBatch(10, context.tenantId);
      });
    }

    if (errorCount === 0) {
      const base = `${successCount} lead${successCount === 1 ? "" : "s"} reatribuído${successCount === 1 ? "" : "s"} com sucesso.`;
      const message = lastError ? `${base} ${lastError}` : base;
      return { success: true, mutationId, changedLeadIds, brokerId, message };
    }

    if (successCount > 0) {
      return {
        success: true,
        mutationId,
        changedLeadIds,
        brokerId,
        message: `${successCount} reatribuído${successCount === 1 ? "" : "s"}, ${errorCount} erro${errorCount === 1 ? "" : "s"}. ${lastError}`,
      };
    }

    return { mutationId, error: `Nenhum lead reatribuído. ${lastError}` };
  } catch (error) {
    return {
      mutationId,
      error: error instanceof Error ? error.message : "Não foi possível reatribuir os leads.",
    };
  }
}

export async function changeLeadStatusAction(
  _previous: StatusChangeState,
  formData: FormData,
): Promise<StatusChangeState> {
  const mutationId = randomUUID();
  const rawInput: ChangeLeadStatusInput = {
    leadId: (formData.get("leadId") ?? "") as string,
    newStatus: (formData.get("newStatus") ?? formData.get("status") ?? "") as string,
    motivoPerda: (formData.get("motivoPerda") ?? formData.get("lossReason")) as string | null,
    justificativaRegressao: (formData.get("justificativaRegressao") ??
      formData.get("regressionJustification")) as string | null,
  };

  try {
    await changeLeadStatus(rawInput);
    return { success: true, mutationId, changedLeadIds: [rawInput.leadId], newStatus: rawInput.newStatus };
  } catch (error) {
    return {
      mutationId,
      error:
        error instanceof Error ? error.message : "Não foi possível alterar o status do lead.",
    };
  }
}

// ─── Bulk status change for directors/managers ────────────────────
// Uses a simpler path that bypasses the per-lead broker-only check
// so directors/managers can change status of any lead in bulk.

async function bulkChangeLeadStatusDirect(
  context: { tenantId: string; userId: string; role: string },
  leadIds: string[],
  newStatus: string,
  motivoPerda: string | null,
) {
  const db = getDatabase();
  const now = new Date();

  const leads = await db
    .select({ id: schema.leads.id, status: schema.leads.status, nome: schema.leads.nome })
    .from(schema.leads)
    .where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.id, leadIds)));

  if (newStatus === "converted") throw new Error("Status 'Convertido' não pode ser definido manualmente.");

  const updatedIds: string[] = [];

  await db.transaction(async (tx) => {
    for (const lead of leads) {
      await tx
        .update(schema.leads)
        .set({
          status: newStatus as never,
          stageEnteredAt: now,
          motivoPerda: newStatus === "lost" ? motivoPerda : null,
        })
        .where(eq(schema.leads.id, lead.id));

      await tx.insert(schema.leadInteractions).values({
        id: randomUUID(),
        leadId: lead.id,
        userId: context.userId,
        tipo: "status_change",
        conteudo: `Status alterado em lote: ${lead.status} → ${newStatus}${newStatus === "lost" ? `. Motivo: ${motivoPerda}` : ""}.`,
      });

      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "lead",
        entidadeId: lead.id,
        acao: newStatus === "lost" ? "perdeu" : "alterou",
      });

      updatedIds.push(lead.id);
    }
  });

  return updatedIds;
}

export async function bulkChangeLeadStatusAction(
  _previous: StatusChangeState,
  formData: FormData,
): Promise<StatusChangeState> {
  const mutationId = randomUUID();
  const leadIds = formData.getAll("leadIds") as string[];
  const newStatus = formData.get("newStatus") as string;
  const motivoPerda = (formData.get("motivoPerda") as string) || null;

  const parsedIds = z.array(z.string().uuid()).min(1).safeParse(leadIds);
  if (!parsedIds.success) return { mutationId, error: "Selecione ao menos um lead válido." };
  if (!newStatus) return { mutationId, error: "Selecione um status válido." };

  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") {
      return { mutationId, error: "Apenas diretores e gestores podem alterar status em lote." };
    }

    const updatedIds = await bulkChangeLeadStatusDirect(context, parsedIds.data, newStatus, motivoPerda);
    if (updatedIds.length) {
      const changedLeads = await getDatabase()
        .select({ branchId: schema.leads.branchId, corretorId: schema.leads.corretorId })
        .from(schema.leads)
        .where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.id, updatedIds)));
      void publishLeadInvalidation({
        tenantId: context.tenantId,
        actorId: context.userId,
        branchIds: changedLeads.map((lead) => lead.branchId),
        brokerIds: changedLeads.map((lead) => lead.corretorId),
      }).catch(() => undefined);
    }

    return {
      success: true,
      mutationId,
      changedLeadIds: updatedIds,
      newStatus,
      message: `${updatedIds.length} lead${updatedIds.length === 1 ? "" : "s"} atualizado${updatedIds.length === 1 ? "" : "s"} com sucesso.`,
    };
  } catch (error) {
    return {
      mutationId,
      error: error instanceof Error ? error.message : "Não foi possível alterar o status dos leads.",
    };
  }
}

// ─── Transferir leads em lote para outra unidade ────────────────────

export type BulkBranchReassignState = {
  success?: boolean;
  error?: string;
  message?: string;
  mutationId?: string;
  changedLeadIds?: string[];
  branchId?: string;
};

export async function bulkReassignBranchAction(
  _previous: BulkBranchReassignState,
  formData: FormData,
): Promise<BulkBranchReassignState> {
  const mutationId = randomUUID();
  const parsed = z.object({
    leadIds: z.array(z.string().uuid()).min(1),
    branchId: z.string().uuid(),
  }).safeParse({ leadIds: formData.getAll("leadIds"), branchId: formData.get("branchId") });

  if (!parsed.success) return { mutationId, error: "Selecione leads e uma unidade válidos." };
  const { leadIds, branchId } = parsed.data;

  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") {
      return { mutationId, error: "Apenas diretores e gestores podem transferir leads de unidade." };
    }

    const db = getDatabase();
    const now = new Date();
    await db.update(schema.leads)
      .set({
        branchId,
        corretorId: null,
        status: "new",
        distributionStatus: "unassigned",
        assignedAt: null,
        updatedAt: now,
      })
      .where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.id, leadIds)));

    void publishLeadInvalidation({
      tenantId: context.tenantId,
      actorId: context.userId,
      branchIds: [branchId],
      brokerIds: [],
    }).catch(() => undefined);

    return {
      success: true,
      mutationId,
      changedLeadIds: leadIds,
      branchId,
      message: `${leadIds.length} lead${leadIds.length === 1 ? "" : "s"} transferido${leadIds.length === 1 ? "" : "s"} para a nova unidade com sucesso.`,
    };
  } catch (error) {
    return {
      mutationId,
      error: error instanceof Error ? error.message : "Não foi possível transferir os leads de unidade.",
    };
  }
}

// ─── Devolver leads em lote para a fila de qualificação ──────────────

export type BulkRevertQualificationState = {
  success?: boolean;
  error?: string;
  message?: string;
  mutationId?: string;
  changedLeadIds?: string[];
};

export async function bulkRevertToQualificationAction(
  _previous: BulkRevertQualificationState,
  formData: FormData,
): Promise<BulkRevertQualificationState> {
  const mutationId = randomUUID();
  const leadIds = formData.getAll("leadIds").map(String).filter((id) => z.string().uuid().safeParse(id).success);

  if (!leadIds.length) return { mutationId, error: "Selecione ao menos um lead para devolver à qualificação." };

  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") {
      return { mutationId, error: "Apenas diretores e gestores podem devolver leads à fila de qualificação." };
    }

    const db = getDatabase();
    const now = new Date();
    await db.update(schema.leads)
      .set({
        qualificationStatus: "qualifying",
        qualificationState: "IN_PROGRESS",
        corretorId: null,
        status: "new",
        distributionStatus: "unassigned",
        assignedAt: null,
        updatedAt: now,
      })
      .where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.id, leadIds)));

    void publishLeadInvalidation({
      tenantId: context.tenantId,
      actorId: context.userId,
      branchIds: [],
      brokerIds: [],
    }).catch(() => undefined);

    return {
      success: true,
      mutationId,
      changedLeadIds: leadIds,
      message: `${leadIds.length} lead${leadIds.length === 1 ? "" : "s"} devolvido${leadIds.length === 1 ? "" : "s"} para a fila de qualificação com sucesso.`,
    };
  } catch (error) {
    return {
      mutationId,
      error: error instanceof Error ? error.message : "Não foi possível devolver os leads para qualificação.",
    };
  }
}
