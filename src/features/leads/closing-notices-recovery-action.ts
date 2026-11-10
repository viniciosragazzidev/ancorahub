"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { notifyDirectorsClosingStage, getClosingDirectorRecipients } from "./closing-director-alert";
import { closingDirectorAlertKey, CLOSING_DIRECTOR_NOTICE_KEY } from "./closing-director-alert-core";
import { manuallyNotifyBrokerClosingStage } from "./closing-stage-notice";
import { closingStageNoticeKey, CLOSING_STAGE_STATUSES } from "./closing-stage-notice-core";
import { formatClosingNoticePreview, planClosingNoticeRecovery, type ClosingNoticeAttempt } from "./closing-notices-recovery-core";
import { teamNoticeByKey } from "@/features/team-notices/catalog";
import { getTeamNoticeSetting } from "@/features/team-notices/service";
import { requireCapability } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

type OutboundRow = ClosingNoticeAttempt & { idempotencyKey: string };

export type ClosingNoticesRecoveryResult = {
  success: boolean;
  summary: string;
  error?: string;
};

async function readOutboundRows(tenantId: string, keys: string[]): Promise<OutboundRow[]> {
  if (keys.length === 0) return [];
  return getDatabase().select({
    idempotencyKey: schema.whatsappOutboundMessages.idempotencyKey,
    status: schema.whatsappOutboundMessages.status,
    sentAt: schema.whatsappOutboundMessages.sentAt,
    queuedAt: schema.whatsappOutboundMessages.queuedAt,
    failedAt: schema.whatsappOutboundMessages.failedAt,
    createdAt: schema.whatsappOutboundMessages.createdAt,
  }).from(schema.whatsappOutboundMessages).where(and(
    eq(schema.whatsappOutboundMessages.tenantId, tenantId),
    inArray(schema.whatsappOutboundMessages.idempotencyKey, keys),
  )).limit(keys.length) as Promise<OutboundRow[]>;
}

function previewFromRows(input: {
  brokerKey: string | null;
  directorKeys: Array<{ phone: string; key: string }>;
  rows: OutboundRow[];
}) {
  const byKey = new Map(input.rows.map((row) => [row.idempotencyKey, row]));
  return formatClosingNoticePreview({
    congratulations: input.brokerKey ? byKey.get(input.brokerKey) ?? null : null,
    directorRecipients: input.directorKeys.map(({ phone, key }) => ({
      label: `final ${phone.slice(-4)}`,
      attempt: byKey.get(key) ?? null,
    })),
  });
}

/** Sends only the missing, independently idempotent closing notices. */
export async function sendClosingNoticesRecoveryAction(rawLeadId: string): Promise<ClosingNoticesRecoveryResult> {
  const parsedLeadId = z.string().uuid().safeParse(rawLeadId);
  if (!parsedLeadId.success) return { success: false, summary: "", error: "Lead inválido." };

  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") {
      return { success: false, summary: "", error: "Somente Diretor ou Gestor pode enviar estes avisos." };
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
      isNull(schema.leads.deletedAt),
      isNull(schema.leads.archivedAt),
    )).limit(1);
    if (!lead) return { success: false, summary: "", error: "Lead não encontrado no seu escopo." };
    if (!CLOSING_STAGE_STATUSES.has(lead.status)) {
      return { success: false, summary: "", error: "O lead não está em uma etapa de fechamento." };
    }
    if (context.role === "manager" && (!context.branchId || lead.branchId !== context.branchId)) {
      return { success: false, summary: "", error: "Lead fora da sua unidade." };
    }

    const [brokerProfile] = lead.brokerId
      ? await db.select({ phone: schema.brokerProfiles.phone }).from(schema.brokerProfiles).where(and(
        eq(schema.brokerProfiles.tenantId, context.tenantId),
        eq(schema.brokerProfiles.userId, lead.brokerId),
      )).limit(1)
      : [];
    const directorRecipients = await getClosingDirectorRecipients(context.tenantId);
    const brokerKey = lead.brokerId ? closingStageNoticeKey(lead.id, lead.brokerId) : null;
    const directorKeys = directorRecipients.map((phone) => ({ phone, key: closingDirectorAlertKey(lead.id, phone) }));
    const allKeys = [...(brokerKey ? [brokerKey] : []), ...directorKeys.map(({ key }) => key)];
    const existingRows = await readOutboundRows(context.tenantId, allKeys);
    const existingKeys = new Set(existingRows.map((row) => row.idempotencyKey));
    const plan = planClosingNoticeRecovery({ brokerKey, directorKeys, existingKeys });

    const brokerNotice = teamNoticeByKey("LEAD_CLOSING_STAGE");
    const brokerEnabled = Boolean(brokerNotice && (await getTeamNoticeSetting(context.tenantId, brokerNotice)).enabled);
    const directorNotice = teamNoticeByKey(CLOSING_DIRECTOR_NOTICE_KEY);
    const directorEnabled = Boolean(directorNotice && (await getTeamNoticeSetting(context.tenantId, directorNotice)).enabled);
    const sendCongratulations = plan.sendCongratulations && brokerEnabled && Boolean(brokerProfile?.phone?.trim()) && Boolean(lead.brokerId);
    const sendDirectorPhones = directorEnabled ? plan.directorPhones : [];

    if (sendCongratulations && lead.brokerId) {
      await manuallyNotifyBrokerClosingStage({
        tenantId: context.tenantId,
        leadId: lead.id,
        leadName: lead.name,
        brokerId: lead.brokerId,
        requestedBy: context.userId,
      });
    }
    if (sendDirectorPhones.length > 0) {
      await notifyDirectorsClosingStage({
        tenantId: context.tenantId,
        leadId: lead.id,
        previousStatus: "negotiation",
        newStatus: lead.status,
        manual: true,
        recipientPhones: sendDirectorPhones,
      });
    }

    const updatedRows = await readOutboundRows(context.tenantId, allKeys);
    const summary = previewFromRows({ brokerKey, directorKeys, rows: updatedRows });
    const attempted = sendCongratulations || sendDirectorPhones.length > 0;
    const hasMissingNotice = plan.sendCongratulations || plan.directorPhones.length > 0;
    const updatedKeys = new Set(updatedRows.map((row) => row.idempotencyKey));
    const remainingMissing = [
      ...(brokerKey && !updatedKeys.has(brokerKey) ? [brokerKey] : []),
      ...directorKeys.filter(({ key }) => !updatedKeys.has(key)).map(({ key }) => key),
    ];
    const success = remainingMissing.length === 0;
    const error = !success
      ? attempted
        ? "Alguns avisos continuam pendentes. Confira o canal e a configuração do template."
        : "Os avisos que faltam estão desativados ou sem destinatário configurado."
      : undefined;

    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "lead",
      entidadeId: lead.id,
      acao: "lead_closing_notices.recovery_triggered",
      metadata: {
        outcome: error ? "partial_or_failed" : attempted ? "registered" : hasMissingNotice ? "nothing_sent" : "nothing_missing",
        resultSummary: summary,
        directorRecipientCount: sendDirectorPhones.length,
      },
    });

    if (success) revalidatePath(`/leads/${lead.id}`);
    return { success, summary, ...(error ? { error } : {}) };
  } catch (error) {
    return {
      success: false,
      summary: "",
      error: error instanceof Error ? error.message : "Não foi possível enviar os avisos de fechamento.",
    };
  }
}
