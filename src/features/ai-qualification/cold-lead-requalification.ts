import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNull, notInArray, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import { operationDayStart } from "@/features/reports/metrics/lead-quality-period";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { runWithConcurrency } from "@/utils/async/run-with-concurrency";
import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { ensureColdLeadReactivationRule } from "./followup-service";
import { isEligibleColdLeadForReactivation } from "./cold-lead-reactivation-policy";
import {
  AUTOMATIC_COLD_LEAD_REQUALIFICATION,
  AUTOMATIC_REQUALIFICATION_LOOKBACK_HOURS,
  automaticRequalificationDue,
  coldSinceAt,
  countRequalificationAttempts,
  COLD_LEAD_REQUALIFICATION_OUTBOUND_PREFIX,
  isRequalificationInCooldown,
  isWithinRequalificationBusinessWindow,
  isEligibleColdLeadForManualRequalification,
  nextRequalificationBusinessWindowAt,
  normalizeColdLeadRequalificationPolicy,
  partitionColdLeadsByResponse,
  requalificationSendDecision,
  runWithRequalificationLock,
  selectColdLeadsForOperationDay,
} from "./cold-lead-requalification-policy";
import { readDistributionPolicy } from "@/features/lead-distribution/domain";

const REQUALIFICATION_PREFIX = COLD_LEAD_REQUALIFICATION_OUTBOUND_PREFIX;
const LEGACY_PREFIX = "cold-lead-reactivation:";

type ReviewLead = {
  id: string;
  nome: string;
  telefone: string;
  queueId: string;
  queueName: string;
  createdAt: Date;
  qualificationStatus: string | null;
  qualificationState: string | null;
  qualificationCompletedAt: Date | null;
  corretorId: string | null;
  status: string;
  distributionStatus: string | null;
  distributionRemovedAt: Date | null;
  archivedAt: Date | null;
  deletedAt: Date | null;
};

function assertDirector(context: TenantContext) {
  if (context.role !== "director") throw new AuthorizationError("Somente o Diretor pode requalificar leads frios.");
}

async function withTenantRequalificationLock<T>(tenantId: string, task: () => Promise<T>) {
  return getDatabase().transaction(async (tx) => runWithRequalificationLock(async () => {
    const [lock] = await tx.execute(sql`
      select pg_try_advisory_xact_lock(hashtext(${tenantId}), hashtext('cold-lead-requalification')) as acquired
    `);
    return lock?.acquired === true;
  }, task));
}

async function getActiveTenantRule(tenantId: string) {
  const db = getDatabase();
  const [rule] = await db.select({ enabled: schema.aiQualificationFollowUpRules.enabled })
    .from(schema.aiQualificationFollowUpRules).where(and(
      eq(schema.aiQualificationFollowUpRules.id, `${LEGACY_PREFIX}${tenantId}`),
      eq(schema.aiQualificationFollowUpRules.tenantId, tenantId),
      eq(schema.aiQualificationFollowUpRules.trigger, "cold_lead_reactivation"),
    )).limit(1);
  return rule?.enabled === true;
}

async function recordAudit(input: { tenantId: string; actorUserId: string | null; leadId: string; action: string; metadata?: Record<string, unknown> }) {
  const db = getDatabase();
  await db.insert(schema.platformAuditLogs).values({
    id: randomUUID(),
    actorUserId: input.actorUserId ?? await resolveSystemUserId(input.tenantId),
    action: input.action,
    targetType: "lead",
    targetId: input.leadId,
    metadata: { tenantId: input.tenantId, ...(input.metadata ?? {}) },
  });
}

export async function getColdLeadRequalificationReview(context: TenantContext, now = new Date()) {
  assertDirector(context);
  const db = getDatabase();
  const since = operationDayStart(now);
  const queues = await db.select({ id: schema.leadQueues.id, name: schema.leadQueues.name })
    .from(schema.leadQueues).where(and(
      eq(schema.leadQueues.tenantId, context.tenantId),
      eq(schema.leadQueues.status, "active"),
      isNull(schema.leadQueues.deletedAt),
    )).orderBy(asc(schema.leadQueues.name));
  if (!queues.length) return { since, queues: [], leadsByQueue: {} as Record<string, { noResponse: ReviewLead[]; respondedStillCold: ReviewLead[] }> };
  const leads = await db.select({
    id: schema.leads.id,
    nome: schema.leads.nome,
    telefone: schema.leads.telefone,
    queueId: schema.leads.queueId,
    queueName: schema.leadQueues.name,
    createdAt: schema.leads.createdAt,
    qualificationStatus: schema.leads.qualificationStatus,
    qualificationState: schema.leads.qualificationState,
    qualificationCompletedAt: schema.leads.qualificationCompletedAt,
    corretorId: schema.leads.corretorId,
    status: schema.leads.status,
    distributionStatus: schema.leads.distributionStatus,
    distributionRemovedAt: schema.leads.distributionRemovedAt,
    archivedAt: schema.leads.archivedAt,
    deletedAt: schema.leads.deletedAt,
  }).from(schema.leads).innerJoin(schema.leadQueues, and(
    eq(schema.leadQueues.id, schema.leads.queueId),
    eq(schema.leadQueues.tenantId, schema.leads.tenantId),
  )).where(and(
    eq(schema.leads.tenantId, context.tenantId),
    inArray(schema.leads.queueId, queues.map((queue) => queue.id)),
    eq(schema.leads.qualificationStatus, "cold"),
    isNull(schema.leads.corretorId),
    gte(schema.leads.createdAt, since),
    isNull(schema.leads.deletedAt),
    isNull(schema.leads.archivedAt),
  )).orderBy(desc(schema.leads.createdAt)).limit(500);
  const selected = selectColdLeadsForOperationDay(leads.filter((lead): lead is typeof lead & { queueId: string; queueName: string } => Boolean(lead.queueId && lead.queueName)), since);
  const leadIds = selected.map((lead) => lead.id);
  const inboundRows = leadIds.length ? await db.select({ leadId: schema.whatsappMessages.leadId, sentAt: schema.whatsappMessages.sentAt })
    .from(schema.whatsappMessages).where(and(
      eq(schema.whatsappMessages.tenantId, context.tenantId),
      inArray(schema.whatsappMessages.leadId, leadIds),
      notInArray(schema.whatsappMessages.direction, ["outbound", "outgoing"]),
    )).orderBy(asc(schema.whatsappMessages.sentAt)) : [];
  const inboundByLead = new Map<string, Date>();
  for (const row of inboundRows) if (row.leadId) inboundByLead.set(row.leadId, row.sentAt);
  const partitions = partitionColdLeadsByResponse(selected, inboundByLead);
  const queueNameById = new Map(queues.map((queue) => [queue.id, queue.name]));
  const group = (rows: typeof partitions.noResponse) => {
    const result: Record<string, ReviewLead[]> = {};
    for (const row of rows) {
      if (!row.queueId) continue;
      (result[row.queueId] ??= []).push({ ...row, queueId: row.queueId, queueName: queueNameById.get(row.queueId) ?? "Fila" });
    }
    return result;
  };
  const noResponse = group(partitions.noResponse);
  const respondedStillCold = group(partitions.respondedStillCold);
  const leadsByQueue = Object.fromEntries(queues.map((queue) => [queue.id, {
    noResponse: noResponse[queue.id] ?? [],
    respondedStillCold: respondedStillCold[queue.id] ?? [],
  }]));
  return { since, queues, leadsByQueue };
}

type OutboundHistory = { id: string; status: string; idempotencyKey: string; sentAt: Date | null; createdAt: Date };

async function readOutboundHistory(tenantId: string, leadIds: string[]) {
  if (!leadIds.length) return [] as Array<OutboundHistory & { recipientId: string | null }>;
  const rows = await getDatabase().select({
    id: schema.whatsappOutboundMessages.id,
    recipientId: schema.whatsappOutboundMessages.recipientId,
    idempotencyKey: schema.whatsappOutboundMessages.idempotencyKey,
    status: schema.whatsappOutboundMessages.status,
    sentAt: schema.whatsappOutboundMessages.sentAt,
    createdAt: schema.whatsappOutboundMessages.createdAt,
  }).from(schema.whatsappOutboundMessages).where(and(
    eq(schema.whatsappOutboundMessages.tenantId, tenantId),
    inArray(schema.whatsappOutboundMessages.recipientId, leadIds),
  ));
  return rows.filter((row) => row.idempotencyKey.startsWith(REQUALIFICATION_PREFIX) || row.idempotencyKey === `${LEGACY_PREFIX}${row.recipientId}`);
}

function reasonFromError(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  return error instanceof Error ? error.message.slice(0, 120) : "Falha ao preparar a mensagem oficial.";
}

async function persistSentMessage(tenantId: string, leadId: string, outboundId: string) {
  const db = getDatabase();
  const [message] = await db.select({
    id: schema.whatsappOutboundMessages.id,
    channelId: schema.whatsappOutboundMessages.channelId,
    providerMessageId: schema.whatsappOutboundMessages.providerMessageId,
    renderedBody: schema.whatsappOutboundMessages.renderedBody,
    destinationPhone: schema.whatsappOutboundMessages.destinationPhone,
  }).from(schema.whatsappOutboundMessages).where(and(
    eq(schema.whatsappOutboundMessages.id, outboundId),
    eq(schema.whatsappOutboundMessages.tenantId, tenantId),
  )).limit(1);
  if (!message) return;
  await db.insert(schema.whatsappMessages).values({
    id: message.providerMessageId || `cold_requalification_${randomUUID()}`,
    tenantId,
    leadId,
    communicationChannelId: message.channelId ?? undefined,
    senderRole: "assistant",
    provider: "meta",
    phone: message.destinationPhone,
    direction: "outbound",
    body: message.renderedBody || "Convite para retomar a qualificacao.",
    providerStatus: "sent",
    messageId: message.providerMessageId ?? undefined,
    sentAt: new Date(),
  }).onConflictDoNothing();
}

export type ColdLeadRequalificationResult = {
  sent: number;
  skipped: Array<{ leadId: string; name: string; reason: string }>;
};

export async function requalifyColdLeadsManually(context: TenantContext, input: { queueId: string; leadIds: string[]; now?: Date }): Promise<ColdLeadRequalificationResult> {
  assertDirector(context);
  const now = input.now ?? new Date();
  const uniqueLeadIds = [...new Set(input.leadIds)].slice(0, 500);
  const db = getDatabase();
  const [queue] = await db.select({ id: schema.leadQueues.id })
    .from(schema.leadQueues).where(and(
      eq(schema.leadQueues.id, input.queueId),
      eq(schema.leadQueues.tenantId, context.tenantId),
      eq(schema.leadQueues.status, "active"),
      isNull(schema.leadQueues.deletedAt),
    )).limit(1);
  if (!queue) throw new AuthorizationError("Fila nao encontrada no escopo do tenant.");
  await ensureColdLeadReactivationRule(context.tenantId);
  const featureEnabled = await getFeatureFlag(FEATURE_FLAGS.COLD_LEAD_REACTIVATION) === "true";
  const tenantRuleEnabled = await getActiveTenantRule(context.tenantId);
  const [policyRow] = await db.select({ policy: schema.leadDistributionPolicies.policy })
    .from(schema.leadDistributionPolicies).where(and(
      eq(schema.leadDistributionPolicies.tenantId, context.tenantId),
      eq(schema.leadDistributionPolicies.queueId, queue.id),
      isNull(schema.leadDistributionPolicies.profileKey),
    )).limit(1);
  const queuePolicy = normalizeColdLeadRequalificationPolicy(readDistributionPolicy(policyRow?.policy).coldLeadRequalification);
  const since = operationDayStart(now);
  const outgoing: Array<{ leadId: string; name: string; outboundId: string }> = [];
  const skipped: ColdLeadRequalificationResult["skipped"] = [];
  let history: Array<OutboundHistory & { recipientId: string | null }> = [];

  const locked = await withTenantRequalificationLock(context.tenantId, async () => {
    const selected = uniqueLeadIds.length ? await db.select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      telefone: schema.leads.telefone,
      queueId: schema.leads.queueId,
      createdAt: schema.leads.createdAt,
      qualificationStatus: schema.leads.qualificationStatus,
      qualificationState: schema.leads.qualificationState,
      qualificationCompletedAt: schema.leads.qualificationCompletedAt,
      corretorId: schema.leads.corretorId,
      status: schema.leads.status,
      distributionStatus: schema.leads.distributionStatus,
      distributionRemovedAt: schema.leads.distributionRemovedAt,
      archivedAt: schema.leads.archivedAt,
      deletedAt: schema.leads.deletedAt,
    }).from(schema.leads).where(and(
      eq(schema.leads.tenantId, context.tenantId),
      eq(schema.leads.queueId, queue.id),
      inArray(schema.leads.id, uniqueLeadIds),
      eq(schema.leads.qualificationStatus, "cold"),
      isNull(schema.leads.corretorId),
      gte(schema.leads.createdAt, since),
      isNull(schema.leads.deletedAt),
      isNull(schema.leads.archivedAt),
    )) : [];
    const byId = new Map(selected.map((lead) => [lead.id, lead]));
    const conversationRows = selected.length ? await db.select({ leadId: schema.aiConversations.leadId, status: schema.aiConversations.status, optOutAt: schema.aiConversations.optOutAt, wrongNumberAt: schema.aiConversations.wrongNumberAt })
      .from(schema.aiConversations).where(and(
        eq(schema.aiConversations.tenantId, context.tenantId),
        inArray(schema.aiConversations.leadId, selected.map((lead) => lead.id)),
      )).orderBy(desc(schema.aiConversations.updatedAt)) : [];
    const conversations = new Map<string, (typeof conversationRows)[number]>();
    for (const row of conversationRows) if (row.leadId && !conversations.has(row.leadId)) conversations.set(row.leadId, row);
    history = await readOutboundHistory(context.tenantId, selected.map((lead) => lead.id));
    const historyByLead = new Map<string, typeof history>();
    for (const row of history) {
      if (!row.recipientId) continue;
      const rows = historyByLead.get(row.recipientId) ?? [];
      rows.push(row);
      historyByLead.set(row.recipientId, rows);
    }

    for (const leadId of uniqueLeadIds) {
      const lead = byId.get(leadId);
      if (!lead || lead.queueId !== queue.id || !isEligibleColdLeadForManualRequalification(lead)) {
        skipped.push({ leadId, name: lead?.nome ?? "Lead", reason: "Lead saiu da fila ou nao esta mais elegivel." });
        if (lead) await recordAudit({ tenantId: context.tenantId, actorUserId: context.userId, leadId, action: "cold_lead_requalification.manual.skipped", metadata: { reason: "not_eligible" } });
        continue;
      }
      if (!featureEnabled || !tenantRuleEnabled) {
        skipped.push({ leadId, name: lead.nome, reason: "A requalificacao esta desligada pelo administrador." });
        await recordAudit({ tenantId: context.tenantId, actorUserId: context.userId, leadId, action: "cold_lead_requalification.manual.skipped", metadata: { reason: "disabled" } });
        continue;
      }
      const conversation = conversations.get(leadId);
      if (conversation?.optOutAt) { skipped.push({ leadId, name: lead.nome, reason: "O lead pediu para parar." }); await recordAudit({ tenantId: context.tenantId, actorUserId: context.userId, leadId, action: "cold_lead_requalification.manual.skipped", metadata: { reason: "opt_out" } }); continue; }
      if (conversation?.wrongNumberAt) { skipped.push({ leadId, name: lead.nome, reason: "O numero foi marcado como invalido." }); await recordAudit({ tenantId: context.tenantId, actorUserId: context.userId, leadId, action: "cold_lead_requalification.manual.skipped", metadata: { reason: "wrong_number" } }); continue; }
      if (["WAITING_HUMAN", "HUMAN_ACTIVE"].includes(conversation?.status ?? "")) { skipped.push({ leadId, name: lead.nome, reason: "O atendimento esta sob responsabilidade humana." }); await recordAudit({ tenantId: context.tenantId, actorUserId: context.userId, leadId, action: "cold_lead_requalification.manual.skipped", metadata: { reason: "human_active" } }); continue; }
      const attempts = (historyByLead.get(leadId) ?? []).filter((row) => !["cancelled", "expired", "skipped"].includes(row.status));
      const latest = attempts.sort((a, b) => (b.sentAt ?? b.createdAt).getTime() - (a.sentAt ?? a.createdAt).getTime())[0];
      if (attempts.some((row) => ["queued", "pending", "processing"].includes(row.status))) {
        skipped.push({ leadId, name: lead.nome, reason: "Ja ha uma requalificacao aguardando envio." });
        await recordAudit({ tenantId: context.tenantId, actorUserId: context.userId, leadId, action: "cold_lead_requalification.manual.skipped", metadata: { reason: "pending" } });
        continue;
      }
      if (isRequalificationInCooldown(latest?.sentAt ?? latest?.createdAt ?? null, now, queuePolicy.intervalMinutes)) {
        skipped.push({ leadId, name: lead.nome, reason: `Aguarde ${queuePolicy.intervalMinutes} minutos entre os envios.` });
        await recordAudit({ tenantId: context.tenantId, actorUserId: context.userId, leadId, action: "cold_lead_requalification.manual.skipped", metadata: { reason: "cooldown" } });
        continue;
      }
      try {
        const queued = await enqueueMetaTemplateMessage({
          tenantId: context.tenantId,
          recipientType: "lead",
          recipientId: lead.id,
          destinationPhone: lead.telefone,
          purpose: "leadQualification",
          variables: [lead.nome || "Cliente", "Assistente Ancora Saude", "Ancora Saude"],
          requestedBy: context.userId,
          idempotencyKey: `${REQUALIFICATION_PREFIX}manual:${lead.id}:${(historyByLead.get(leadId)?.length ?? 0) + 1}`,
          requireApprovedMetaTemplate: true,
        });
        outgoing.push({ leadId, name: lead.nome, outboundId: queued.id });
      } catch (error) {
        const reason = reasonFromError(error);
        skipped.push({ leadId, name: lead.nome, reason });
        await recordAudit({ tenantId: context.tenantId, actorUserId: context.userId, leadId, action: "cold_lead_requalification.manual.skipped", metadata: { reason } });
      }
    }
  });

  if (!locked.acquired) {
    return { sent: 0, skipped: uniqueLeadIds.map((leadId) => ({ leadId, name: "Lead", reason: "Outra requalificacao esta em andamento; tente novamente." })) };
  }

  let sent = 0;
  await runWithConcurrency(outgoing, 4, async (queued) => {
    const delivery = await processMetaOutboundBatch(1, context.tenantId, queued.outboundId).catch(() => null);
    if (delivery?.sent) {
      await persistSentMessage(context.tenantId, queued.leadId, queued.outboundId);
      await recordAudit({ tenantId: context.tenantId, actorUserId: context.userId, leadId: queued.leadId, action: "cold_lead_requalification.manual.sent", metadata: { outboundId: queued.outboundId } });
      sent += 1;
    } else {
      const [row] = await db.select({ status: schema.whatsappOutboundMessages.status, providerErrorCode: schema.whatsappOutboundMessages.providerErrorCode })
        .from(schema.whatsappOutboundMessages).where(and(eq(schema.whatsappOutboundMessages.id, queued.outboundId), eq(schema.whatsappOutboundMessages.tenantId, context.tenantId))).limit(1);
      const reason = row?.providerErrorCode ?? "A Meta nao confirmou o envio.";
      skipped.push({ leadId: queued.leadId, name: queued.name, reason });
      await recordAudit({ tenantId: context.tenantId, actorUserId: context.userId, leadId: queued.leadId, action: "cold_lead_requalification.manual.skipped", metadata: { reason } });
    }
  });
  return { sent, skipped };
}

export type ColdLeadRequalificationSweepResult = { tenantsChecked: number; candidates: number; queued: number; sent: number; skipped: number; locked: number };

export async function runColdLeadRequalificationSweep(tenantIdFilter?: string, now = new Date()): Promise<ColdLeadRequalificationSweepResult> {
  const disabled = { tenantsChecked: 0, candidates: 0, queued: 0, sent: 0, skipped: 0, locked: 0 };
  if (await getFeatureFlag(FEATURE_FLAGS.COLD_LEAD_REACTIVATION) !== "true") return disabled;
  const db = getDatabase();
  const tenants = await db.select({ id: schema.tenants.id }).from(schema.tenants).where(and(
    eq(schema.tenants.status, "active"), tenantIdFilter ? eq(schema.tenants.id, tenantIdFilter) : undefined,
  ));
  const summary = { ...disabled, tenantsChecked: tenants.length };
  for (const { id: tenantId } of tenants) {
    await ensureColdLeadReactivationRule(tenantId);
    const tenantEnabled = await getActiveTenantRule(tenantId);
    if (!tenantEnabled) continue;
    // The qualification turbo cadence sends its own +3h reminder (anc_t2_beneficio): no second message.
    const { turboCadenceCoversRequalification } = await import("@/features/qualification-turbo/cadence-job");
    if (await turboCadenceCoversRequalification(tenantId).catch(() => false)) continue;
    const locked = await withTenantRequalificationLock(tenantId, async () => {
      // Every automatic queue, one try 3 hours after the lead turned cold (decision of 20/10):
      // the per-queue switch no longer gates it, and the timeout holds (the panel's cold leads) count.
      const cfg = AUTOMATIC_COLD_LEAD_REQUALIFICATION;
      const queues = await db.select({ id: schema.leadQueues.id }).from(schema.leadQueues).where(and(
        eq(schema.leadQueues.tenantId, tenantId), eq(schema.leadQueues.assignmentMode, "automatic"),
        eq(schema.leadQueues.status, "active"), isNull(schema.leadQueues.deletedAt),
      ));
      if (!queues.length) return { candidates: 0, queued: 0, sent: 0, skipped: 0 };
      // A lead turns cold minutes after arriving; the extra day covers late timeouts.
      const arrivedSince = new Date(now.getTime() - (AUTOMATIC_REQUALIFICATION_LOOKBACK_HOURS + 24) * 60 * 60_000);
      const leads = await db.select({
        id: schema.leads.id,
        tenantId: schema.leads.tenantId,
        createdAt: schema.leads.createdAt,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        queueId: schema.leads.queueId,
        qualificationStatus: schema.leads.qualificationStatus,
        qualificationState: schema.leads.qualificationState,
        qualificationCompletedAt: schema.leads.qualificationCompletedAt,
        corretorId: schema.leads.corretorId,
        status: schema.leads.status,
        distributionStatus: schema.leads.distributionStatus,
        distributionRemovedAt: schema.leads.distributionRemovedAt,
        archivedAt: schema.leads.archivedAt,
        deletedAt: schema.leads.deletedAt,
      }).from(schema.leads).where(and(
        eq(schema.leads.tenantId, tenantId), inArray(schema.leads.queueId, queues.map((queue) => queue.id)),
        eq(schema.leads.qualificationStatus, "cold"), isNull(schema.leads.corretorId),
        isNull(schema.leads.distributionRemovedAt), isNull(schema.leads.archivedAt), isNull(schema.leads.deletedAt),
        notInArray(schema.leads.status, ["lost", "converted", "under_analysis"]),
        notInArray(schema.leads.distributionStatus, ["assigned", "held", "removed", "returned_to_queue"]),
        gte(schema.leads.createdAt, arrivedSince),
      )).orderBy(asc(schema.leads.createdAt)).limit(200);
      const eligible = leads.filter((lead) => lead.queueId && isEligibleColdLeadForManualRequalification(lead));
      if (!eligible.length) return { candidates: 0, queued: 0, sent: 0, skipped: 0 };
      const leadIds = eligible.map((lead) => lead.id);
      const [conversations, inboundRows, outboundRows, timeoutHolds] = await Promise.all([
        db.selectDistinctOn([schema.aiConversations.tenantId, schema.aiConversations.leadId], {
          leadId: schema.aiConversations.leadId, status: schema.aiConversations.status, optOutAt: schema.aiConversations.optOutAt, wrongNumberAt: schema.aiConversations.wrongNumberAt,
        }).from(schema.aiConversations).where(and(eq(schema.aiConversations.tenantId, tenantId), inArray(schema.aiConversations.leadId, leadIds)))
          .orderBy(schema.aiConversations.tenantId, schema.aiConversations.leadId, desc(schema.aiConversations.updatedAt)),
        db.select({ leadId: schema.whatsappMessages.leadId, sentAt: schema.whatsappMessages.sentAt })
          .from(schema.whatsappMessages).where(and(eq(schema.whatsappMessages.tenantId, tenantId), inArray(schema.whatsappMessages.leadId, leadIds), notInArray(schema.whatsappMessages.direction, ["outbound", "outgoing"])))
          .orderBy(asc(schema.whatsappMessages.sentAt)),
        db.select({ recipientId: schema.whatsappOutboundMessages.recipientId, id: schema.whatsappOutboundMessages.id, idempotencyKey: schema.whatsappOutboundMessages.idempotencyKey, status: schema.whatsappOutboundMessages.status, sentAt: schema.whatsappOutboundMessages.sentAt, createdAt: schema.whatsappOutboundMessages.createdAt })
          .from(schema.whatsappOutboundMessages).where(and(eq(schema.whatsappOutboundMessages.tenantId, tenantId), inArray(schema.whatsappOutboundMessages.recipientId, leadIds))),
        // When a lead without valid data turned cold: the timeout hold (it has no qualification end).
        db.select({ leadId: schema.leadDistributionEvents.leadId, at: sql<string>`max(${schema.leadDistributionEvents.createdAt})` })
          .from(schema.leadDistributionEvents).where(and(
            eq(schema.leadDistributionEvents.tenantId, tenantId), inArray(schema.leadDistributionEvents.leadId, leadIds),
            eq(schema.leadDistributionEvents.action, "qualification_timeout_manual_hold"),
          )).groupBy(schema.leadDistributionEvents.leadId),
      ]);
      const conversationByLead = new Map(conversations.map((row) => [row.leadId, row]));
      const inboundByLead = new Map<string, Date>();
      for (const row of inboundRows) if (row.leadId) inboundByLead.set(row.leadId, row.sentAt);
      const timeoutHoldByLead = new Map(timeoutHolds.map((row) => [row.leadId, new Date(row.at)]));
      const historyByLead = new Map<string, typeof outboundRows>();
      for (const row of outboundRows) {
        if (!row.recipientId || (!row.idempotencyKey.startsWith(REQUALIFICATION_PREFIX) && row.idempotencyKey !== `${LEGACY_PREFIX}${row.recipientId}`)) continue;
        const rows = historyByLead.get(row.recipientId) ?? [];
        rows.push(row);
        historyByLead.set(row.recipientId, rows);
      }
      let queuedCount = 0;
      let sentCount = 0;
      let skippedCount = 0;
      for (const lead of eligible) {
        const convo = conversationByLead.get(lead.id);
        const history = historyByLead.get(lead.id) ?? [];
        const attempts = countRequalificationAttempts(history);
        if (history.some((row) => ["queued", "pending", "processing"].includes(row.status))) { skippedCount += 1; continue; }
        const coldSince = coldSinceAt(lead, timeoutHoldByLead.get(lead.id));
        if (!automaticRequalificationDue({ coldSince, attempts, now })) continue;
        const attempted = history.filter((row) => !["cancelled", "expired", "skipped"].includes(row.status));
        const latestAttempt = [...attempted].sort((a, b) => (b.sentAt ?? b.createdAt).getTime() - (a.sentAt ?? a.createdAt).getTime())[0];
        // The client wrote after turning cold: the conversation resumes on its own, no invite needed.
        const latestInboundAt = inboundByLead.get(lead.id) ?? null;
        const decision = requalificationSendDecision({
          policy: cfg,
          attempts,
          hasInboundSinceLastPrompt: Boolean(latestInboundAt && latestInboundAt.getTime() > coldSince.getTime()),
          optedOut: Boolean(convo?.optOutAt),
          wrongNumber: Boolean(convo?.wrongNumberAt),
          eligible: !["WAITING_HUMAN", "HUMAN_ACTIVE"].includes(convo?.status ?? ""),
          lastAttemptAt: latestAttempt?.sentAt ?? latestAttempt?.createdAt ?? null,
          now,
        });
        if (!decision.allowed) { skippedCount += 1; continue; }
        if (!isWithinRequalificationBusinessWindow(now)) continue;
        const attempt = history.length + 1;
        try {
          const queued = await enqueueMetaTemplateMessage({
            tenantId, recipientType: "lead", recipientId: lead.id, destinationPhone: lead.telefone,
            purpose: "leadQualification", variables: [lead.nome || "Cliente", "Assistente Ancora Saude", "Ancora Saude"],
            idempotencyKey: `${REQUALIFICATION_PREFIX}auto:${lead.id}:${attempt}`, requireApprovedMetaTemplate: true,
            scheduledAt: nextRequalificationBusinessWindowAt(now),
          });
          if (!queued.duplicate) queuedCount += 1;
          const delivery = await processMetaOutboundBatch(1, tenantId, queued.id).catch(() => null);
          if (delivery?.sent) {
            await persistSentMessage(tenantId, lead.id, queued.id);
            await recordAudit({ tenantId, actorUserId: null, leadId: lead.id, action: "cold_lead_requalification.automatic.sent", metadata: { queueId: lead.queueId, attempt } });
            sentCount += 1;
          }
        } catch (error) {
          skippedCount += 1;
          await recordAudit({ tenantId, actorUserId: null, leadId: lead.id, action: "cold_lead_requalification.automatic.skipped", metadata: { queueId: lead.queueId, reason: reasonFromError(error) } });
        }
      }
      return { candidates: eligible.length, queued: queuedCount, sent: sentCount, skipped: skippedCount };
    });
    if (!locked.acquired) { summary.locked += 1; continue; }
    summary.candidates += locked.value.candidates;
    summary.queued += locked.value.queued;
    summary.sent += locked.value.sent;
    summary.skipped += locked.value.skipped;
  }
  return summary;
}

export const coldLeadRequalificationOutboundPrefix = REQUALIFICATION_PREFIX;
