"use server";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getManagerUnitScope } from "@/features/broker-workspace/manager-unit-scope";
import { changeLeadStatus } from "@/features/leads/change-lead-status";
import { MOTIVOS_PERDA } from "@/features/leads/lead-status-constants";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export type ManagerLeadStatusState = {
  success?: boolean;
  error?: string;
  newStatus?: string;
  mutationId?: string;
};

/**
 * Trocar a etapa do lead na ficha do gestor Lite. O escopo é re-checado aqui no servidor
 * (gestor e unidade, lead ativo da unidade) antes da mudança pelo fluxo de status existente.
 */
export async function changeManagerLeadStatusAction(_previous: ManagerLeadStatusState, formData: FormData): Promise<ManagerLeadStatusState> {
  const mutationId = randomUUID();
  const context = await getRequiredTenantContext();
  const scope = getManagerUnitScope(context);
  if (!scope) return { mutationId, error: "Só o gestor da unidade pode alterar a etapa deste lead." };

  const leadId = String(formData.get("leadId") ?? "");
  const newStatus = String(formData.get("newStatus") ?? "");
  const motivoPerda = String(formData.get("motivoPerda") ?? "") || null;
  if (!leadId || !newStatus) return { mutationId, error: "Escolha a nova etapa." };
  if (newStatus === "lost" && !(MOTIVOS_PERDA as readonly string[]).includes(motivoPerda ?? "")) {
    return { mutationId, error: "Escolha o motivo da perda." };
  }

  const db = getDatabase();
  const [lead] = await db
    .select({ id: schema.leads.id })
    .from(schema.leads)
    .where(and(
      eq(schema.leads.id, leadId),
      eq(schema.leads.tenantId, scope.tenantId),
      eq(schema.leads.branchId, scope.branchId),
      isNull(schema.leads.deletedAt),
      isNull(schema.leads.archivedAt),
    ))
    .limit(1);
  if (!lead) return { mutationId, error: "Este lead não está na sua unidade." };

  try {
    await changeLeadStatus({ leadId, newStatus, motivoPerda, justificativaRegressao: null });
    return { mutationId, success: true, newStatus };
  } catch (error) {
    return { mutationId, error: error instanceof Error ? error.message : "Não foi possível alterar a etapa." };
  }
}
