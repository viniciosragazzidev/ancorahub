import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";

import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { getColdLeadReactivationAt, isEligibleColdLeadForReactivation } from "./cold-lead-reactivation-policy";
import { ensureColdLeadReactivationRule } from "./followup-service";

const REACTIVATION_KEY_PREFIX = "cold-lead-reactivation:";
const ELIGIBILITY_BLOCKED_ACTION = "cold_lead_reactivation.cancelled_not_eligible";

export type ColdLeadReactivationSweepResult = {
  tenantsChecked: number;
  candidates: number;
  queued: number;
  sent: number;
  blocked: number;
};

async function recordBlockedOnce(tenantId: string, leadId: string, reason: string) {
  const db = getDatabase();
  const action = `cold_lead_reactivation.blocked:${reason}`;
  const [existing] = await db.select({ id: schema.auditLogs.id }).from(schema.auditLogs).where(and(
    eq(schema.auditLogs.entidade, "lead"),
    eq(schema.auditLogs.entidadeId, leadId),
    eq(schema.auditLogs.acao, action),
  )).limit(1);
  if (existing) return;
  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: await resolveSystemUserId(tenantId),
    entidade: "lead",
    entidadeId: leadId,
    acao: action,
    createdAt: new Date(),
  });
}

export async function runColdLeadReactivationSweep(tenantIdFilter?: string): Promise<ColdLeadReactivationSweepResult> {
  const disabledResult = { tenantsChecked: 0, candidates: 0, queued: 0, sent: 0, blocked: 0 };
  if (await getFeatureFlag(FEATURE_FLAGS.COLD_LEAD_REACTIVATION) !== "true") return disabledResult;

  const db = getDatabase();
  const tenants = await db.select({ id: schema.tenants.id }).from(schema.tenants).where(and(
    eq(schema.tenants.status, "active"),
    tenantIdFilter ? eq(schema.tenants.id, tenantIdFilter) : undefined,
  ));
  await Promise.all(tenants.map(({ id }) => ensureColdLeadReactivationRule(id)));

  const candidates = await db.select({
    id: schema.leads.id,
    tenantId: schema.leads.tenantId,
    nome: schema.leads.nome,
    telefone: schema.leads.telefone,
    qualificationStatus: schema.leads.qualificationStatus,
    qualificationState: schema.leads.qualificationState,
    qualificationCompletedAt: schema.leads.qualificationCompletedAt,
    corretorId: schema.leads.corretorId,
    status: schema.leads.status,
    distributionStatus: schema.leads.distributionStatus,
    distributionRemovedAt: schema.leads.distributionRemovedAt,
    archivedAt: schema.leads.archivedAt,
    deletedAt: schema.leads.deletedAt,
  }).from(schema.leads)
    .innerJoin(schema.tenants, and(
      eq(schema.tenants.id, schema.leads.tenantId),
      eq(schema.tenants.status, "active"),
    ))
    .innerJoin(schema.aiQualificationFollowUpRules, and(
      eq(schema.aiQualificationFollowUpRules.tenantId, schema.leads.tenantId),
      eq(schema.aiQualificationFollowUpRules.id, sql`'cold-lead-reactivation:' || ${schema.leads.tenantId}`),
      eq(schema.aiQualificationFollowUpRules.trigger, "cold_lead_reactivation"),
      eq(schema.aiQualificationFollowUpRules.enabled, true),
    ))
    .where(and(
      tenantIdFilter ? eq(schema.leads.tenantId, tenantIdFilter) : undefined,
      eq(schema.leads.qualificationStatus, "cold"),
      inArray(schema.leads.qualificationState, ["QUALIFIED", "COMPLETED"]),
      isNotNull(schema.leads.qualificationCompletedAt),
      isNull(schema.leads.corretorId),
      notInArray(schema.leads.status, ["lost", "converted", "under_analysis"]),
      notInArray(schema.leads.distributionStatus, ["assigned", "manual_hold", "held", "removed", "returned_to_queue"]),
      isNull(schema.leads.distributionRemovedAt),
      isNull(schema.leads.archivedAt),
      isNull(schema.leads.deletedAt),
    ))
    .orderBy(asc(schema.leads.qualificationCompletedAt))
    .limit(200);

  const result: ColdLeadReactivationSweepResult = {
    tenantsChecked: tenants.length,
    candidates: candidates.length,
    queued: 0,
    sent: 0,
    blocked: 0,
  };
  const now = new Date();

  for (const lead of candidates) {
    if (!isEligibleColdLeadForReactivation(lead) || !lead.qualificationCompletedAt) continue;
    const [conversation] = await db.select({ optOutAt: schema.aiConversations.optOutAt, wrongNumberAt: schema.aiConversations.wrongNumberAt })
      .from(schema.aiConversations).where(and(
        eq(schema.aiConversations.tenantId, lead.tenantId),
        eq(schema.aiConversations.leadId, lead.id),
      )).orderBy(desc(schema.aiConversations.updatedAt)).limit(1);
    if (conversation?.optOutAt || conversation?.wrongNumberAt) continue;

    const idempotencyKey = `${REACTIVATION_KEY_PREFIX}${lead.id}`;
    const [existing] = await db.select({ id: schema.whatsappOutboundMessages.id, status: schema.whatsappOutboundMessages.status })
      .from(schema.whatsappOutboundMessages).where(and(
        eq(schema.whatsappOutboundMessages.tenantId, lead.tenantId),
        eq(schema.whatsappOutboundMessages.idempotencyKey, idempotencyKey),
      )).limit(1);

    let outboundId = existing?.id;
    if (!existing) {
      const scheduledAt = getColdLeadReactivationAt(lead.qualificationCompletedAt, now);
      try {
        const queued = await enqueueMetaTemplateMessage({
          tenantId: lead.tenantId,
          recipientType: "lead",
          recipientId: lead.id,
          destinationPhone: lead.telefone,
          purpose: "leadQualification",
          variables: [lead.nome || "Cliente", "Assistente Âncora Saúde", "Âncora Saúde"],
          idempotencyKey,
          scheduledAt,
          requireApprovedMetaTemplate: true,
        });
        outboundId = queued.id;
        if (!queued.duplicate) result.queued += 1;
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
          ? error.code
          : "OUTBOUND_UNAVAILABLE";
        await recordBlockedOnce(lead.tenantId, lead.id, code);
        result.blocked += 1;
        continue;
      }
    } else if (["sent", "delivered", "read", "cancelled", "expired", "skipped"].includes(existing.status)) {
      continue;
    }

    if (!outboundId) continue;
    const delivery = await processMetaOutboundBatch(1, lead.tenantId, outboundId).catch((error) => {
      console.error("[cold-lead-reactivation] delivery_deferred", {
        tenantId: lead.tenantId,
        leadId: lead.id,
        error: error instanceof Error ? error.message.slice(0, 160) : "unknown_error",
      });
      return null;
    });
    if (delivery?.sent) {
      const [message] = await db.select({
        id: schema.whatsappOutboundMessages.id,
        channelId: schema.whatsappOutboundMessages.channelId,
        providerMessageId: schema.whatsappOutboundMessages.providerMessageId,
        renderedBody: schema.whatsappOutboundMessages.renderedBody,
        destinationPhone: schema.whatsappOutboundMessages.destinationPhone,
      }).from(schema.whatsappOutboundMessages).where(and(
        eq(schema.whatsappOutboundMessages.id, outboundId),
        eq(schema.whatsappOutboundMessages.tenantId, lead.tenantId),
      )).limit(1);
      if (message) {
        await db.insert(schema.whatsappMessages).values({
          id: message.providerMessageId || `cold_reactivation_${randomUUID()}`,
          tenantId: lead.tenantId,
          leadId: lead.id,
          communicationChannelId: message.channelId ?? undefined,
          senderRole: "assistant",
          provider: "meta",
          phone: message.destinationPhone,
          direction: "outbound",
          body: message.renderedBody || "Reenvio do convite de qualificação.",
          providerStatus: "sent",
          messageId: message.providerMessageId ?? undefined,
          sentAt: new Date(),
        }).onConflictDoNothing();
      }
      result.sent += 1;
    }
  }

  return result;
}

export const coldLeadReactivationOutboundPrefix = REACTIVATION_KEY_PREFIX;
export const coldLeadReactivationIneligibleAuditAction = ELIGIBILITY_BLOCKED_ACTION;
