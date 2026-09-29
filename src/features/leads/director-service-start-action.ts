"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { publishNotification } from "@/features/notifications/send-push-helper";
import { publishLeadInvalidation } from "@/features/leads/publish-lead-invalidation";
import { startServiceOnFirstMessage } from "@/features/leads/start-service-on-message";
import { canDirectorMarkLeadInService } from "./director-service-start";

const leadId = z.string().uuid();

export type MarkLeadInServiceState = { success: boolean; error?: string };

export async function markLeadInServiceAction(inputLeadId: string): Promise<MarkLeadInServiceState> {
  const parsed = leadId.safeParse(inputLeadId);
  if (!parsed.success) return { success: false, error: "Lead inválido." };

  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { success: false, error: "Somente o diretor pode marcar o lead como em atendimento." };

    const [lead] = await getDatabase()
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        corretorId: schema.leads.corretorId,
        branchId: schema.leads.branchId,
        status: schema.leads.status,
        deletedAt: schema.leads.deletedAt,
        archivedAt: schema.leads.archivedAt,
      })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, parsed.data), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);

    if (!lead) return { success: false, error: "Lead não encontrado." };
    if (!canDirectorMarkLeadInService({ role: context.role, ...lead }) || !lead.corretorId) {
      return { success: false, error: "Este lead não está aguardando o início do atendimento." };
    }

    const updated = await startServiceOnFirstMessage({
      tenantId: context.tenantId,
      leadId: lead.id,
      brokerId: lead.corretorId,
      branchId: lead.branchId,
      trigger: "director",
      actorId: context.userId,
    });
    if (!updated) return { success: false, error: "O lead mudou de responsável ou já está em atendimento." };

    revalidatePath("/leads");
    revalidatePath(`/leads/${lead.id}`);
    revalidatePath("/minha-fila");

    const brokerId = lead.corretorId;
    void publishNotification({
      capability: "lead_service_started",
      tenantId: context.tenantId,
      recipientUserId: brokerId,
      leadId: lead.id,
      type: "lead_service_started",
      title: "Lead em atendimento",
      message: `O diretor marcou o lead ${lead.nome} como em atendimento. Ele está confirmado com você.`,
      pushTitle: "Lead em atendimento ✅",
      pushBody: `O lead ${lead.nome} foi marcado como em atendimento e está confirmado com você.`,
      url: `/leads/${lead.id}`,
      tag: `lead-${lead.id}`,
    }).catch(() => undefined);
    void publishLeadInvalidation({
      tenantId: context.tenantId,
      actorId: context.userId,
      branchIds: [lead.branchId],
      brokerIds: [brokerId],
    }).catch(() => undefined);

    return { success: true };
  } catch {
    return { success: false, error: "Não foi possível marcar o lead como em atendimento." };
  }
}
