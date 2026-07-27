"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";

import { notifyNewLead, notifyLeadReassigned } from "@/features/notifications/send-push-helper";

const inputSchema = z.object({ leadId: z.string().uuid(), brokerId: z.string().uuid().nullable() });
export type ManagementActionState = { success?: boolean; error?: string };

async function getManagedLead(leadId: string) {
  const context = await getRequiredTenantContext();
  if (context.role !== "manager" && context.role !== "director") throw new AuthorizationError("Apenas Gestores e Diretores podem gerenciar leads.");
  const db = getDatabase();
  const [lead] = await db.select({ id: schema.leads.id, nome: schema.leads.nome, tenantId: schema.leads.tenantId, branchId: schema.leads.branchId, status: schema.leads.status, corretorId: schema.leads.corretorId })
    .from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  if (!lead) throw new Error("Lead não encontrado.");
  if (context.role === "manager" && context.branchId !== lead.branchId) throw new AuthorizationError("Este lead está fora da sua filial.");
  return { context, db, lead };
}

export async function reassignLeadAction(_prev: ManagementActionState, formData: FormData): Promise<ManagementActionState> {
  try {
    const input = inputSchema.parse({ leadId: formData.get("leadId"), brokerId: String(formData.get("brokerId") || "") || null });
    const { context, db, lead } = await getManagedLead(input.leadId);
    if (["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(lead.status)) throw new Error("Este lead já está em atendimento. Finalize ou libere o atendimento atual antes de reatribuir.");
    if (!input.brokerId) throw new Error("Selecione um corretor para reatribuir o lead.");
    const brokerId = input.brokerId;
    const [broker] = await db.select({ id: schema.user.id, branchId: schema.tenantMemberships.branchId }).from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, input.brokerId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true))).limit(1);
    if (!broker || broker.branchId !== lead.branchId) throw new Error("O corretor selecionado não pertence à filial deste lead.");
    const now = new Date();
    const [tenantPolicy] = await db.select({ feedbackRequiredEnabled: schema.tenants.feedbackRequiredEnabled, feedbackGraceMinutes: schema.tenants.feedbackGraceMinutes, slaFirstContactMinutes: schema.tenants.slaFirstContactMinutes }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1);
    await db.transaction(async (tx) => {
      await tx.update(schema.leads).set({ corretorId: input.brokerId, status: "distributed", assignedAt: now, firstContactAt: null, serviceStartedAt: null, serviceStartedBy: null, stageEnteredAt: now, motivoPerda: null }).where(eq(schema.leads.id, lead.id));
      if (tenantPolicy?.feedbackRequiredEnabled !== false) await tx.insert(schema.leadAssignmentAttempts).values({ id: randomUUID(), tenantId: lead.tenantId, leadId: lead.id, brokerId, sequence: 1, assignedAt: now, feedbackDueAt: new Date(now.getTime() + ((Number.parseInt(tenantPolicy?.slaFirstContactMinutes ?? "15", 10) || 15) + (Number.parseInt(tenantPolicy?.feedbackGraceMinutes ?? "5", 10) || 5)) * 60_000), status: "open", createdAt: now });
      await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId: lead.id, userId: context.userId, tipo: "system_alert", conteudo: `Lead reatribuído por ${context.role === "director" ? "Diretor" : "Gestor"}; SLA reiniciado.` });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: lead.id, acao: "reatribuiu_lead" });
    });

    // Trigger push notifications in background
    await notifyNewLead(lead.id, lead.tenantId, lead.branchId, input.brokerId, lead.nome).catch(console.error);
    // Notify the previous broker that the lead was reassigned
    if (lead.corretorId && lead.corretorId !== input.brokerId) {
      void notifyLeadReassigned(lead.id, lead.tenantId, lead.corretorId, lead.nome).catch(console.error);
    }

    revalidatePath(`/leads/${lead.id}`); revalidatePath("/leads"); revalidatePath("/dashboard");
    return { success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível reatribuir o lead." }; }
}

export async function assumeLeadForInvestigationAction(_prev: ManagementActionState, formData: FormData): Promise<ManagementActionState> {
  try {
    const leadId = z.string().uuid().parse(formData.get("leadId"));
    const reason = z.string().trim().min(3).max(200).parse(formData.get("reason"));
    const { context, db, lead } = await getManagedLead(leadId);
    if (["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(lead.status)) throw new Error("Este lead já está ativo em atendimento e não pode ser assumido por outro usuário.");
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(schema.leads).set({ corretorId: context.userId, status: "under_analysis", assignedAt: now, stageEnteredAt: now, firstContactAt: null, serviceStartedAt: null, serviceStartedBy: null }).where(eq(schema.leads.id, lead.id));
      await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId: lead.id, userId: context.userId, tipo: "system_alert", conteudo: `Lead assumido para investigação por ${context.role === "director" ? "Diretor" : "Gestor"}. Motivo: ${reason}` });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: lead.id, acao: "assumiu_lead_investigacao" });
    });
    revalidatePath(`/leads/${lead.id}`); revalidatePath("/leads"); revalidatePath("/dashboard");
    return { success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível assumir o lead para investigação." }; }
}

export async function assumeLeadForMessagingAction(leadId: string): Promise<ManagementActionState> {
  try {
    const { context, db, lead } = await getManagedLead(z.string().uuid().parse(leadId));
    if (lead.corretorId === context.userId) return { success: true };
    if (!lead.corretorId) throw new Error("Este lead ainda não possui um corretor responsável.");
    const currentOwnerId = lead.corretorId;
    if (!["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(lead.status)) {
      throw new Error("O atendimento só pode ser assumido quando já estiver ativo.");
    }
    const now = new Date();
    const updated = await db.transaction(async (tx) => {
      const result = await tx.update(schema.leads).set({ corretorId: context.userId, assignedAt: now, stageEnteredAt: now, serviceStartedBy: context.userId })
        .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.corretorId, currentOwnerId)))
        .returning({ id: schema.leads.id });
      if (!result.length) return false;
      await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId: lead.id, userId: context.userId, tipo: "system_alert", conteudo: `${context.role === "director" ? "Diretor" : "Gestor"} assumiu o atendimento para continuidade da conversa.` });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: lead.id, acao: "assumiu_atendimento" });
      return true;
    });
    if (!updated) throw new Error("Este atendimento foi assumido por outra pessoa. Atualize a página.");
    revalidatePath(`/leads/${lead.id}`); revalidatePath("/leads"); revalidatePath("/dashboard");
    return { success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível assumir o atendimento." }; }
}
