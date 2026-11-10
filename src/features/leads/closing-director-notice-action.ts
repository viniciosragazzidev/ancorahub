"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { notifyDirectorsClosingStage, getClosingDirectorRecipients } from "./closing-director-alert";
import { closingDirectorAlertKey, CLOSING_DIRECTOR_NOTICE_KEY } from "./closing-director-alert-core";
import { teamNoticeByKey } from "@/features/team-notices/catalog";
import { getTeamNoticeSetting } from "@/features/team-notices/service";
import { requireCapability } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { CLOSING_STAGE_STATUSES } from "./closing-stage-notice-core";

export type ClosingDirectorActionResult = { success: true; message: string } | { success: false; error: string };

/** Manually recovers the director notice for a lead already in closing, once per configured phone. */
export async function sendMissedClosingDirectorNoticeAction(rawLeadId: string): Promise<ClosingDirectorActionResult> {
  const parsedLeadId = z.string().uuid().safeParse(rawLeadId);
  if (!parsedLeadId.success) return { success: false, error: "Lead inválido." };

  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") {
      return { success: false, error: "Somente Diretor ou Gestor pode avisar a direção." };
    }
    await requireCapability(context, "alterar_status_lead");

    const db = getDatabase();
    const [lead] = await db.select({
      id: schema.leads.id,
      name: schema.leads.nome,
      status: schema.leads.status,
      branchId: schema.leads.branchId,
    }).from(schema.leads).where(and(
      eq(schema.leads.id, parsedLeadId.data),
      eq(schema.leads.tenantId, context.tenantId),
      isNull(schema.leads.deletedAt),
      isNull(schema.leads.archivedAt),
    )).limit(1);
    if (!lead) return { success: false, error: "Lead não encontrado no seu escopo." };
    if (!CLOSING_STAGE_STATUSES.has(lead.status)) return { success: false, error: "O lead não está em uma etapa de fechamento." };
    if (context.role === "manager" && (!context.branchId || lead.branchId !== context.branchId)) {
      return { success: false, error: "Lead fora da sua unidade." };
    }

    const notice = teamNoticeByKey(CLOSING_DIRECTOR_NOTICE_KEY);
    if (!notice || !(await getTeamNoticeSetting(context.tenantId, notice)).enabled) {
      return { success: false, error: "O aviso à direção está desativado nas configurações de comunicação." };
    }
    const recipients = await getClosingDirectorRecipients(context.tenantId);
    if (!recipients.length) return { success: false, error: "Nenhum número da direção está configurado para receber este aviso." };

    const keys = recipients.map((phone) => closingDirectorAlertKey(lead.id, phone));
    const existing = await db.select({ idempotencyKey: schema.whatsappOutboundMessages.idempotencyKey })
      .from(schema.whatsappOutboundMessages).where(and(
        eq(schema.whatsappOutboundMessages.tenantId, context.tenantId),
        inArray(schema.whatsappOutboundMessages.idempotencyKey, keys),
      )).limit(recipients.length);
    if (existing.length === recipients.length) {
      return { success: false, error: "O aviso já foi registrado para todos os números da direção." };
    }

    await notifyDirectorsClosingStage({
      tenantId: context.tenantId,
      leadId: lead.id,
      previousStatus: "negotiation",
      newStatus: lead.status,
      manual: true,
    });

    const outbound = await db.select({ idempotencyKey: schema.whatsappOutboundMessages.idempotencyKey, status: schema.whatsappOutboundMessages.status })
      .from(schema.whatsappOutboundMessages).where(and(
        eq(schema.whatsappOutboundMessages.tenantId, context.tenantId),
        inArray(schema.whatsappOutboundMessages.idempotencyKey, keys),
      )).limit(recipients.length);
    const newlyRegistered = outbound.filter((item) => !existing.some((previous) => previous.idempotencyKey === item.idempotencyKey));
    const successful = newlyRegistered.filter((item) => ["sent", "queued", "pending", "processing"].includes(item.status));
    const outcome = successful.some((item) => item.status === "sent")
      ? "sent"
      : successful.length
        ? "queued"
        : newlyRegistered.length
          ? "failed"
          : "duplicate";

    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "lead",
      entidadeId: lead.id,
      acao: "lead_closing_director.manual_triggered",
      metadata: { outcome, recipientCount: newlyRegistered.length },
    });

    if (outcome === "sent") {
      revalidatePath(`/leads/${lead.id}`);
      return { success: true, message: "Aviso enviado à direção." };
    }
    if (outcome === "queued") {
      revalidatePath(`/leads/${lead.id}`);
      return { success: true, message: "Aviso colocado na fila para a direção." };
    }
    if (outcome === "duplicate") return { success: false, error: "O aviso já foi registrado para todos os números da direção." };
    return { success: false, error: "Não foi possível enviar o aviso à direção. Confira o canal oficial e a configuração do template." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível avisar a direção." };
  }
}
