"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { changeLeadStatus, type ChangeLeadStatusInput } from "@/features/leads/change-lead-status";
import { assignLeadToBroker } from "@/features/lead-distribution/service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export type StatusChangeState = {
  success?: boolean;
  error?: string;
  message?: string;
};

// ─── Bulk reassign leads to a broker ────────────────────────────

export type BulkReassignState = {
  success?: boolean;
  error?: string;
  message?: string;
};

export async function bulkReassignLeadsAction(
  _previous: BulkReassignState,
  formData: FormData,
): Promise<BulkReassignState> {
  const leadIds = formData.getAll("leadIds") as string[];
  const brokerId = formData.get("brokerId") as string;

  if (!leadIds.length) return { error: "Nenhum lead selecionado." };
  if (!brokerId) return { error: "Selecione um corretor válido." };

  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") {
      return { error: "Apenas diretores e gestores podem reatribuir leads." };
    }

    const source = context.role === "director" ? "manual_director" : "manual_manager";
    let successCount = 0;
    let errorCount = 0;
    let lastError = "";

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

    // Revalidate
    for (const id of leadIds) {
    }

    if (errorCount === 0) {
      const base = `${successCount} lead${successCount === 1 ? "" : "s"} reatribuído${successCount === 1 ? "" : "s"} com sucesso.`;
      const message = lastError ? `${base} ${lastError}` : base;
      return { success: true, message };
    }

    if (successCount > 0) {
      return {
        success: true,
        message: `${successCount} reatribuído${successCount === 1 ? "" : "s"}, ${errorCount} erro${errorCount === 1 ? "" : "s"}. ${lastError}`,
      };
    }

    return { error: `Nenhum lead reatribuído. ${lastError}` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível reatribuir os leads.",
    };
  }
}

export async function changeLeadStatusAction(
  _previous: StatusChangeState,
  formData: FormData,
): Promise<StatusChangeState> {
  const rawInput: ChangeLeadStatusInput = {
    leadId: (formData.get("leadId") ?? "") as string,
    newStatus: (formData.get("newStatus") ?? formData.get("status") ?? "") as string,
    motivoPerda: (formData.get("motivoPerda") ?? formData.get("lossReason")) as string | null,
  };

  try {
    await changeLeadStatus(rawInput);
    return { success: true };
  } catch (error) {
    return {
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
  const leadIds = formData.getAll("leadIds") as string[];
  const newStatus = formData.get("newStatus") as string;
  const motivoPerda = (formData.get("motivoPerda") as string) || null;

  if (!leadIds.length) return { error: "Nenhum lead selecionado." };
  if (!newStatus) return { error: "Selecione um status válido." };

  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") {
      return { error: "Apenas diretores e gestores podem alterar status em lote." };
    }

    const updatedIds = await bulkChangeLeadStatusDirect(context, leadIds, newStatus, motivoPerda);

    for (const id of updatedIds) {
    }

    return {
      success: true,
      message: `${updatedIds.length} lead${updatedIds.length === 1 ? "" : "s"} atualizado${updatedIds.length === 1 ? "" : "s"} com sucesso.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível alterar o status dos leads.",
    };
  }
}
