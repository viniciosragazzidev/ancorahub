import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, isNotNull, isNull } from "drizzle-orm";

import { enqueueMetaTemplateMessage } from "@/features/communication-channels/outbound-service";
import { isNotificationCapabilityEnabled } from "@/features/notifications/queries";
import { publishNotification } from "@/features/notifications/send-push-helper";
import { getDatabase, schema } from "@/shared/db";
import {
  assignedDayLabel,
  CLIENT_RETURNED_AFTER_HOURS,
  CLIENT_RETURNED_AUDIT_ACTION,
  CLIENT_RETURNED_LOOKBACK_MINUTES,
  INBOUND_DIRECTIONS,
  isOfficialNumberInbound,
  shouldNotifyClientReturned,
} from "./client-returned-core";

export type ClientReturnedResult = { checked: number; notified: number; failed: number };

/**
 * Tells the broker when a lead distributed to them more than 24 h ago writes again on the company's
 * official number, never on the broker's own WhatsApp (29/10): a
 * WhatsApp notice ("Cliente voltou a chamar", channel chosen in Avisos da equipe) plus the in-app
 * notice. Once per lead, ever. Runs in the reminders job; never throws.
 */
export async function runClientReturnedAlerts(now = new Date()): Promise<ClientReturnedResult> {
  const result: ClientReturnedResult = { checked: 0, notified: 0, failed: 0 };
  try {
    if (!(await isNotificationCapabilityEnabled("lead_client_returned"))) return result;
    const db = getDatabase();
    const since = new Date(now.getTime() - CLIENT_RETURNED_LOOKBACK_MINUTES * 60_000);
    const rows = await db
      .select({
        tenantId: schema.whatsappMessages.tenantId,
        leadId: schema.leads.id,
        leadName: schema.leads.nome,
        brokerId: schema.leads.corretorId,
        assignedAt: schema.leads.assignedAt,
        messageAt: schema.whatsappMessages.sentAt,
        provider: schema.whatsappMessages.provider,
        channelId: schema.communicationChannels.id,
        channelProvider: schema.communicationChannels.provider,
        channelType: schema.communicationChannels.channelType,
        channelOwnerUserId: schema.communicationChannels.ownerUserId,
        whatsappConnectionId: schema.whatsappMessages.whatsappConnectionId,
      })
      .from(schema.whatsappMessages)
      .innerJoin(schema.leads, and(eq(schema.leads.id, schema.whatsappMessages.leadId), eq(schema.leads.tenantId, schema.whatsappMessages.tenantId)))
      // Only the company's official number (29/10): the client writing on the broker's own WhatsApp
      // is already in front of the broker.
      .innerJoin(schema.communicationChannels, and(eq(schema.communicationChannels.id, schema.whatsappMessages.communicationChannelId), eq(schema.communicationChannels.tenantId, schema.whatsappMessages.tenantId)))
      .where(and(
        eq(schema.whatsappMessages.provider, "meta_cloud"),
        eq(schema.communicationChannels.provider, "meta_cloud"),
        eq(schema.communicationChannels.channelType, "shared"),
        isNull(schema.communicationChannels.ownerUserId),
        isNull(schema.whatsappMessages.whatsappConnectionId),
        gte(schema.whatsappMessages.sentAt, since),
        inArray(schema.whatsappMessages.direction, [...INBOUND_DIRECTIONS]),
        isNotNull(schema.leads.corretorId),
        isNotNull(schema.leads.assignedAt),
        isNull(schema.leads.deletedAt),
      ))
      .orderBy(desc(schema.whatsappMessages.sentAt))
      .limit(300);
    // The newest official-number message of each lead (re-checked here on top of the query).
    const byLead = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (row.messageAt && isOfficialNumberInbound(row) && !byLead.has(row.leadId)) byLead.set(row.leadId, row);
    const leads = [...byLead.values()].filter((row) => shouldNotifyClientReturned({ ...row, messageAt: row.messageAt!, alreadyNotified: false }));
    result.checked = leads.length;
    if (!leads.length) return result;

    const notified = new Set((await db
      .select({ leadId: schema.auditLogs.entidadeId })
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.entidade, "lead"), inArray(schema.auditLogs.entidadeId, leads.map((row) => row.leadId)), eq(schema.auditLogs.acao, CLIENT_RETURNED_AUDIT_ACTION))))
      .map((row) => row.leadId));

    for (const row of leads) {
      if (notified.has(row.leadId) || !row.brokerId || !row.assignedAt) continue;
      try {
        // Marked first: a failure later never makes the same lead notify twice.
        await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: row.brokerId, entidade: "lead", entidadeId: row.leadId, acao: CLIENT_RETURNED_AUDIT_ACTION, createdAt: now });
        const [broker] = await db
          .select({ name: schema.user.name, phone: schema.brokerProfiles.phone })
          .from(schema.user)
          .leftJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.userId, schema.user.id), eq(schema.brokerProfiles.tenantId, row.tenantId)))
          .where(eq(schema.user.id, row.brokerId))
          .limit(1);
        const brokerName = broker?.name?.trim().split(/\s+/)[0] || "Corretor(a)";
        const leadName = row.leadName?.trim() || "Seu cliente";
        const since = assignedDayLabel(row.assignedAt);
        const key = `client-returned:${row.leadId}`;
        await Promise.allSettled([
          broker?.phone
            ? enqueueMetaTemplateMessage({
              tenantId: row.tenantId,
              recipientType: "user",
              recipientId: row.brokerId,
              destinationPhone: broker.phone,
              purpose: "leadClientReturned",
              variables: [brokerName, leadName, since, row.leadId],
              requestedBy: null,
              idempotencyKey: key,
            })
            : Promise.resolve(null),
          publishNotification({
            capability: "lead_client_returned",
            tenantId: row.tenantId,
            recipientUserId: row.brokerId,
            leadId: row.leadId,
            type: "lead_client_returned",
            title: `${leadName} voltou a chamar`,
            message: `${leadName} mandou mensagem agora. O lead está com você desde ${since}: responda enquanto o interesse está quente.`,
            pushTitle: "Cliente voltou a chamar",
            pushBody: `${leadName} mandou mensagem agora. Responda logo.`,
            url: `/leads/${row.leadId}`,
            tag: `lead-${row.leadId}`,
            idempotencyKey: key,
          }),
        ]).then((settled) => settled.forEach((item) => {
          if (item.status === "rejected") console.warn("[client-returned] notice_failed", { leadId: row.leadId, error: item.reason instanceof Error ? item.reason.message.slice(0, 200) : "unknown" });
        }));
        result.notified += 1;
      } catch (error) {
        result.failed += 1;
        console.error("[client-returned] lead_failed", { leadId: row.leadId, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
      }
    }
  } catch (error) {
    console.error("[client-returned] sweep_failed", { error: error instanceof Error ? error.message.slice(0, 200) : "unknown", afterHours: CLIENT_RETURNED_AFTER_HOURS });
  }
  return result;
}
