import "server-only";

import { and, eq, or } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { publishNotification } from "@/features/notifications/send-push-helper";
import { startServiceOnFirstMessage } from "./start-service-on-message";

export type StartBrokerLeadResult =
  | { ok: true; lead: { id: string; nome: string; telefone: string; branchId: string | null } }
  | { ok: false; error: string };

/**
 * Início do atendimento pelo corretor dono do lead: o mesmo serviço do botão do CRM (Lite e ficha).
 * Quem chama cuida da resposta (CRM: link do WhatsApp; extensão: telefone e saudação). Não envia mensagem.
 */
export async function startBrokerLeadService(context: TenantContext, leadId: string): Promise<StartBrokerLeadResult> {
  const db = getDatabase();

  const [lead] = await db
    .select({
      id: schema.leads.id,
      tenantId: schema.leads.tenantId,
      nome: schema.leads.nome,
      branchId: schema.leads.branchId,
      corretorId: schema.leads.corretorId,
      telefone: schema.leads.telefone,
      status: schema.leads.status,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)))
    .limit(1);

  if (!lead) return { ok: false, error: "Lead não encontrado." };
  if (context.role !== "broker" || lead.corretorId !== context.userId) {
    return { ok: false, error: "Somente o corretor responsável pode iniciar este atendimento." };
  }

  const [broker] = await db
    .select({ name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, context.userId))
    .limit(1);

  if (lead.status !== "distributed") {
    return {
      ok: false,
      error: lead.status === "in_contact" ? "Este atendimento já foi iniciado." : "Este lead não está disponível para início de atendimento.",
    };
  }

  const recipientScope = lead.branchId
    ? or(eq(schema.tenantMemberships.role, "director"), eq(schema.tenantMemberships.branchId, lead.branchId))
    : eq(schema.tenantMemberships.role, "director");

  const managersAndDirectors = await db
    .select({ userId: schema.tenantMemberships.userId, role: schema.tenantMemberships.role })
    .from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.status, "active"), recipientScope));

  const updated = await startServiceOnFirstMessage({
    tenantId: context.tenantId,
    leadId: lead.id,
    brokerId: context.userId,
    branchId: lead.branchId,
    trigger: "button",
  });

  if (!updated) return { ok: false, error: "Este lead já foi assumido ou não está mais disponível." };

  // Fire notifications asynchronously OUTSIDE database transaction
  void (async () => {
    try {
      const notify = managersAndDirectors.filter(
        (recipient) => recipient.userId !== context.userId && (recipient.role === "director" || recipient.role === "manager")
      );

      await Promise.allSettled(
        notify.map((recipient) =>
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
        )
      );

      await publishNotification({
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
    } catch (err) {
      console.error("Non-blocking notification dispatch error:", err);
    }
  })();

  return { ok: true, lead: { id: lead.id, nome: lead.nome, telefone: lead.telefone, branchId: lead.branchId } };
}
