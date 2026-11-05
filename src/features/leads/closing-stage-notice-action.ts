"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { manuallyNotifyBrokerClosingStage } from "./closing-stage-notice";
import { closingStageNoticeKey, CLOSING_STAGE_STATUSES } from "./closing-stage-notice-core";
import { teamNoticeByKey } from "@/features/team-notices/catalog";
import { getTeamNoticeSetting } from "@/features/team-notices/service";
import { requireCapability } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export type ClosingNoticeActionResult = { success: true; message: string } | { success: false; error: string };

export async function sendMissedClosingStageNoticeAction(rawLeadId: string): Promise<ClosingNoticeActionResult> {
  const parsedLeadId = z.string().uuid().safeParse(rawLeadId);
  if (!parsedLeadId.success) return { success: false, error: "Lead inválido." };

  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") {
      return { success: false, error: "Somente Diretor ou Gestor pode enviar este aviso." };
    }
    await requireCapability(context, "alterar_status_lead");

    const db = getDatabase();
    const [lead] = await db.select({
      id: schema.leads.id,
      name: schema.leads.nome,
      status: schema.leads.status,
      brokerId: schema.leads.corretorId,
      branchId: schema.leads.branchId,
    }).from(schema.leads).where(and(
      eq(schema.leads.id, parsedLeadId.data),
      eq(schema.leads.tenantId, context.tenantId),
    )).limit(1);
    if (!lead) return { success: false, error: "Lead não encontrado no seu escopo." };
    if (!CLOSING_STAGE_STATUSES.has(lead.status)) return { success: false, error: "O lead não está em uma etapa de fechamento." };
    if (!lead.brokerId) return { success: false, error: "O lead está sem corretor responsável." };
    if (context.role === "manager" && (!context.branchId || lead.branchId !== context.branchId)) {
      return { success: false, error: "Lead fora da sua unidade." };
    }

    const notice = teamNoticeByKey("LEAD_CLOSING_STAGE");
    if (!notice || !(await getTeamNoticeSetting(context.tenantId, notice)).enabled) {
      return { success: false, error: "O aviso de fechamento está desativado nas configurações de comunicação." };
    }

    const [broker] = await db.select({ phone: schema.brokerProfiles.phone })
      .from(schema.brokerProfiles)
      .where(and(
        eq(schema.brokerProfiles.userId, lead.brokerId),
        eq(schema.brokerProfiles.tenantId, context.tenantId),
      )).limit(1);
    if (!broker?.phone?.trim()) return { success: false, error: "O corretor responsável não tem telefone cadastrado para receber o WhatsApp." };

    const idempotencyKey = closingStageNoticeKey(lead.id, lead.brokerId);
    const [existing] = await db.select({ id: schema.whatsappOutboundMessages.id })
      .from(schema.whatsappOutboundMessages)
      .where(and(
        eq(schema.whatsappOutboundMessages.tenantId, context.tenantId),
        eq(schema.whatsappOutboundMessages.idempotencyKey, idempotencyKey),
      )).limit(1);
    if (existing) return { success: false, error: "O aviso já foi registrado para este corretor e lead." };

    const result = await manuallyNotifyBrokerClosingStage({
      tenantId: context.tenantId,
      leadId: lead.id,
      leadName: lead.name,
      brokerId: lead.brokerId,
      requestedBy: context.userId,
    });
    const [outbound] = await db.select({ status: schema.whatsappOutboundMessages.status })
      .from(schema.whatsappOutboundMessages)
      .where(and(
        eq(schema.whatsappOutboundMessages.tenantId, context.tenantId),
        eq(schema.whatsappOutboundMessages.idempotencyKey, idempotencyKey),
      )).limit(1);

    const outcome = result.notified && outbound?.status === "sent"
      ? "sent"
      : result.notified && (outbound?.status === "queued" || outbound?.status === "pending")
        ? "queued"
        : "failed";
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "lead",
      entidadeId: lead.id,
      acao: "lead_closing_stage.manual_triggered",
      metadata: { outcome, recipientUserId: lead.brokerId },
    });

    if (outcome === "sent") {
      revalidatePath(`/leads/${lead.id}`);
      return { success: true, message: "Aviso enviado ao corretor responsável." };
    }
    if (outcome === "queued") {
      revalidatePath(`/leads/${lead.id}`);
      return { success: true, message: "Aviso colocado na fila de envio." };
    }
    return { success: false, error: "Não foi possível enviar o aviso. Confira o canal oficial e a configuração do template." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível enviar o aviso." };
  }
}
