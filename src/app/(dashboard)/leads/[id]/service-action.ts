"use server";

import { randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { publishNotification } from "@/features/notifications/send-push-helper";

export type StartLeadServiceState = { success?: boolean; error?: string; whatsappUrl?: string };

export async function startLeadServiceAction(_prev: StartLeadServiceState, formData: FormData): Promise<StartLeadServiceState> {
  const leadId = String(formData.get("leadId") ?? "");
  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();
    const [lead] = await db.select({ id: schema.leads.id, tenantId: schema.leads.tenantId, nome: schema.leads.nome, branchId: schema.leads.branchId, corretorId: schema.leads.corretorId, telefone: schema.leads.telefone, status: schema.leads.status })
      .from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
    if (!lead) return { error: "Lead não encontrado." };
    if (context.role !== "broker" || lead.corretorId !== context.userId) return { error: "Somente o corretor responsável pode iniciar este atendimento." };
    const [broker] = await db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, context.userId)).limit(1);
    if (lead.status !== "distributed") return { error: lead.status === "in_contact" ? "Este atendimento já foi iniciado." : "Este lead não está disponível para início de atendimento." };
    const now = new Date();
    const recipientScope = lead.branchId ? or(eq(schema.tenantMemberships.role, "director"), eq(schema.tenantMemberships.branchId, lead.branchId)) : eq(schema.tenantMemberships.role, "director");
    const managersAndDirectors = await db.select({ userId: schema.tenantMemberships.userId, role: schema.tenantMemberships.role })
      .from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.status, "active"), recipientScope));
    const updated = await db.transaction(async (tx) => {
      const result = await tx.update(schema.leads).set({ status: "in_contact", stageEnteredAt: now, firstContactAt: now, serviceStartedAt: now, serviceStartedBy: context.userId })
        .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.corretorId, context.userId), eq(schema.leads.status, "distributed")))
        .returning({ id: schema.leads.id });
      if (!result.length) return false;
      await tx.update(schema.leadAssignmentAttempts).set({ status: "submitted", firstContactAt: now }).where(and(eq(schema.leadAssignmentAttempts.leadId, lead.id), eq(schema.leadAssignmentAttempts.brokerId, context.userId), eq(schema.leadAssignmentAttempts.status, "open")));
      await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId: lead.id, userId: context.userId, tipo: "service_started", conteudo: "Corretor iniciou o atendimento e os dados pessoais foram liberados." });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: lead.id, acao: "iniciou_atendimento_whatsapp" });
      const notify = managersAndDirectors.filter((recipient) => recipient.userId !== context.userId && (recipient.role === "director" || recipient.role === "manager"));
      // Notify managers and directors via publishNotification (in-app + push)
      await Promise.allSettled(notify.map((recipient) =>
        publishNotification({
          capability: "lead_service_started",
          tenantId: context.tenantId,
          recipientUserId: recipient.userId,
          leadId: lead.id,
          type: "lead_service_started",
          title: "Atendimento iniciado",
          message: `${broker?.name ?? "O corretor"} iniciou o atendimento do lead ${lead.nome}.`,
          pushTitle: "Atendimento Iniciado! 🟢",
          pushBody: `${broker?.name ?? "O corretor"} iniciou o atendimento de ${lead.nome}.`,
          url: `/leads/${lead.id}`,
          tag: `lead-${lead.id}`,
        }).catch(() => { /* non-blocking */ })
      ));
      // Notify the broker who started the service
      void publishNotification({
        capability: "lead_service_started",
        tenantId: context.tenantId,
        recipientUserId: context.userId,
        leadId: lead.id,
        type: "lead_service_started",
        title: "Atendimento ativo",
        message: `Você iniciou o atendimento de ${lead.nome}. O lead agora está sob sua responsabilidade.`,
        pushTitle: "Atendimento Ativo! ✅",
        pushBody: `Você iniciou o atendimento de ${lead.nome}. Dados liberados!`,
        url: `/leads/${lead.id}`,
        tag: `lead-${lead.id}`,
      }).catch(() => { /* non-blocking */ });
      return true;
    });
    if (!updated) return { error: "Este lead já foi assumido ou não está mais disponível." };
    revalidatePath(`/leads/${lead.id}`);
    revalidatePath("/leads");
    return { success: true, whatsappUrl: `https://wa.me/${lead.telefone.replace(/\D/g, "")}` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível iniciar o atendimento." };
  }
}
