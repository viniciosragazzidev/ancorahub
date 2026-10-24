import "server-only";

import { and, desc, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { getQualificationTenantSettings } from "@/features/ai-qualification/tenant-settings-service";
import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { getDatabase, schema } from "@/shared/db";
import { withJobLease } from "@/shared/db/job-lease";

import { qualificationTemplateVariables, requestedOperator } from "./approaches";
import { decideNextTouch, type TurboState, type TurboTouchRecord } from "./cadence";
import { companyNameFor, getTurboSettings, listApprovedTemplateNames, readTurboState, writeTurboState } from "./service";

/** Leads looked at per run (every 2 minutes); "wait" decisions cost no network call. */
const MAX_LEADS_PER_RUN = 1000;
/** The cadence ends three days after the first contact; a week is the safety margin. */
const LOOKBACK_MS = 7 * 24 * 60 * 60_000;
const TIME_BUDGET_MS = 100_000;

const CLOSED_QUALIFICATION = new Set(["qualified", "hot", "warm", "waiting_human", "disqualified", "no_whatsapp_contact", "meta_blocked"]);

/** The automatic +3h requalification is replaced by the cadence when its +3h touch can go out. */
export async function turboCadenceCoversRequalification(tenantId: string) {
  const settings = await getTurboSettings(tenantId);
  if (!settings.enabled || !settings.cadence) return false;
  return (await listApprovedTemplateNames(tenantId)).has("anc_t2_beneficio");
}

async function recordSentMessage(tenantId: string, leadId: string, outboundId: string) {
  const db = getDatabase();
  const [message] = await db.select({
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
    id: message.providerMessageId || `qualification_turbo_${outboundId}`,
    tenantId,
    leadId,
    communicationChannelId: message.channelId ?? undefined,
    senderRole: "assistant",
    provider: "meta",
    phone: message.destinationPhone,
    direction: "outbound",
    body: message.renderedBody || "Lembrete da cotação de plano de saúde.",
    providerStatus: "sent",
    messageId: message.providerMessageId ?? undefined,
    sentAt: new Date(),
  }).onConflictDoNothing();
}

export type CadenceRunResult = { candidates: number; sent: number; failed: number; skipped: number; stopped: number };

/**
 * Reminder cadence of the qualification turbo (Coolify, every 2 minutes;
 * docs/runbooks/coolify-scheduled-tasks.md). Sends T1 to T4 to leads that got
 * the first contact and did not answer, within the rules of cadence.ts.
 */
export async function runQualificationCadenceJob(now = new Date()): Promise<CadenceRunResult | { skipped: "locked" }> {
  // One run at a time: an overlapping run would write the turbo state from a stale snapshot.
  // A lease, not a transaction held open for the whole run (it pinned a DB socket, 24/10).
  const lease = await withJobLease("qualification-turbo-cadence", TIME_BUDGET_MS + 60_000, () => runCadence(now));
  return lease.acquired ? lease.value : { skipped: "locked" as const };
}

async function runCadence(now: Date): Promise<CadenceRunResult> {
  const db = getDatabase();
  const started = Date.now();
  const result: CadenceRunResult = { candidates: 0, sent: 0, failed: 0, skipped: 0, stopped: 0 };

  const leads = await db.select({
    id: schema.leads.id,
    tenantId: schema.leads.tenantId,
    nome: schema.leads.nome,
    telefone: schema.leads.telefone,
    status: schema.leads.status,
    corretorId: schema.leads.corretorId,
    qualificationStatus: schema.leads.qualificationStatus,
    qualificationDetails: schema.leads.qualificationDetails,
    tipo: schema.leads.tipo,
    sourceCampaign: schema.leads.sourceCampaign,
    sourceMetadata: schema.leads.sourceMetadata,
  }).from(schema.leads).where(and(
    gt(schema.leads.createdAt, new Date(now.getTime() - LOOKBACK_MS)),
    isNull(schema.leads.deletedAt),
    isNull(schema.leads.archivedAt),
    isNotNull(schema.leads.telefone),
    sql`${schema.leads.qualificationDetails}->'turbo'->>'firstContactAt' is not null`,
    sql`${schema.leads.qualificationDetails}->'turbo'->>'stoppedAt' is null`,
  // Oldest last touch first, so leads waiting for T3/T4 are never starved by new ones.
  )).orderBy(sql`(${schema.leads.qualificationDetails}->'turbo'->'touches'->-1->>'at') asc nulls first`).limit(MAX_LEADS_PER_RUN);
  result.candidates = leads.length;
  if (!leads.length) return result;

  const leadIds = leads.map((lead) => lead.id);
  const [inbound, conversations] = await Promise.all([
    db.select({ leadId: schema.whatsappMessages.leadId, at: sql<string>`max(${schema.whatsappMessages.sentAt})` })
      .from(schema.whatsappMessages)
      .where(and(inArray(schema.whatsappMessages.leadId, leadIds), inArray(schema.whatsappMessages.direction, ["incoming", "inbound"])))
      .groupBy(schema.whatsappMessages.leadId),
    db.selectDistinctOn([schema.aiConversations.leadId], {
      leadId: schema.aiConversations.leadId,
      status: schema.aiConversations.status,
      optOutAt: schema.aiConversations.optOutAt,
      wrongNumberAt: schema.aiConversations.wrongNumberAt,
    }).from(schema.aiConversations).where(inArray(schema.aiConversations.leadId, leadIds))
      .orderBy(schema.aiConversations.leadId, desc(schema.aiConversations.updatedAt)),
  ]);
  const lastInbound = new Map(inbound.map((row) => [row.leadId, row.at ? new Date(row.at) : null]));
  const conversationByLead = new Map(conversations.map((row) => [row.leadId, row]));

  const tenantCache = new Map<string, { cadence: boolean; approved: Set<string>; empresa: string; botName: string }>();
  const tenantContext = async (tenantId: string) => {
    const cached = tenantCache.get(tenantId);
    if (cached) return cached;
    const settings = await getTurboSettings(tenantId);
    const [approved, empresa, qualification] = await Promise.all([
      listApprovedTemplateNames(tenantId),
      companyNameFor(tenantId, settings),
      getQualificationTenantSettings(tenantId).catch(() => null),
    ]);
    const value = { cadence: settings.enabled && settings.cadence, approved, empresa, botName: qualification?.assistantName?.trim() || "Assistente" };
    tenantCache.set(tenantId, value);
    return value;
  };

  for (const lead of leads) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    const state = readTurboState(lead.qualificationDetails);
    if (!state) continue;
    const tenant = await tenantContext(lead.tenantId);
    if (!tenant.cadence) continue;
    const conversation = conversationByLead.get(lead.id);
    const decision = decideNextTouch({
      state,
      now,
      lastInboundAt: lastInbound.get(lead.id) ?? null,
      optedOut: Boolean(conversation?.optOutAt || conversation?.wrongNumberAt),
      humanActive: ["WAITING_HUMAN", "HUMAN_ACTIVE"].includes(conversation?.status ?? ""),
      assignedToBroker: Boolean(lead.corretorId),
      closed: ["lost", "converted"].includes(lead.status) || CLOSED_QUALIFICATION.has(lead.qualificationStatus ?? ""),
      approvedTemplates: tenant.approved,
    });

    if (decision.action === "wait") continue;
    if (decision.action === "stop") {
      await writeTurboState(lead.tenantId, lead.id, { ...state, stoppedAt: now.toISOString(), stopReason: decision.reason });
      result.stopped += 1;
      continue;
    }
    if (decision.action === "skip") {
      const skipped: TurboTouchRecord = { touch: decision.step.touch, template: decision.step.template, at: now.toISOString(), status: "skipped", errorCode: decision.reason };
      await writeTurboState(lead.tenantId, lead.id, { ...state, touches: [...state.touches, skipped] });
      result.skipped += 1;
      continue;
    }

    const attempt = state.touches.filter((touch) => touch.touch === decision.step.touch).length + 1;
    const operadora = requestedOperator({ tipo: lead.tipo, sourceCampaign: lead.sourceCampaign, sourceMetadata: lead.sourceMetadata as Record<string, unknown> | null });
    let record: TurboTouchRecord = { touch: decision.step.touch, template: decision.step.template, at: now.toISOString(), status: "failed" };
    try {
      const queued = await enqueueMetaTemplateMessage({
        tenantId: lead.tenantId,
        recipientType: "lead",
        recipientId: lead.id,
        destinationPhone: lead.telefone,
        purpose: "leadQualification",
        variables: qualificationTemplateVariables(lead.nome || "Cliente", tenant.botName, tenant.empresa, operadora),
        idempotencyKey: `qualification-turbo:${lead.id}:${decision.step.touch}:${attempt}`,
        requireApprovedMetaTemplate: true,
        templateName: decision.step.template,
      });
      record = { ...record, outboundId: queued.id };
      await processMetaOutboundBatch(1, lead.tenantId, queued.id).catch(() => null);
      const [row] = await db.select({ status: schema.whatsappOutboundMessages.status, errorCode: schema.whatsappOutboundMessages.providerErrorCode })
        .from(schema.whatsappOutboundMessages)
        .where(and(eq(schema.whatsappOutboundMessages.id, queued.id), eq(schema.whatsappOutboundMessages.tenantId, lead.tenantId)))
        .limit(1);
      if (row && ["sent", "delivered", "read"].includes(row.status)) {
        record = { ...record, status: "sent" };
        await recordSentMessage(lead.tenantId, lead.id, queued.id);
        result.sent += 1;
      } else if (row && ["queued", "pending"].includes(row.status)) {
        // Held by the outbox: cancel it (it could go out later, outside the window) and retry next run.
        await db.update(schema.whatsappOutboundMessages).set({ status: "cancelled", updatedAt: new Date() })
          .where(and(eq(schema.whatsappOutboundMessages.id, queued.id), eq(schema.whatsappOutboundMessages.tenantId, lead.tenantId), inArray(schema.whatsappOutboundMessages.status, ["queued", "pending"])));
        record = { ...record, errorCode: "held" };
        result.failed += 1;
      } else {
        record = { ...record, errorCode: row?.errorCode ?? row?.status ?? "not_sent" };
        result.failed += 1;
      }
    } catch (error) {
      record = { ...record, errorCode: error instanceof Error ? error.message.slice(0, 80) : "error" };
      result.failed += 1;
    }
    const next: TurboState = { ...state, touches: [...state.touches, record] };
    await writeTurboState(lead.tenantId, lead.id, next);
  }
  return result;
}
