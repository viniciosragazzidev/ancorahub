import "server-only";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { getQualificationTenantSettings } from "@/features/ai-qualification/tenant-settings-service";
import { getActiveWabaId } from "@/features/communication-channels/message-policy-service";
import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { resolveCanonicalWhatsAppDestination } from "@/features/communication-channels/phone-resolution";
import { getPreferredMetaCloudChannel, sendMetaCloudChannelText } from "@/features/communication-channels/service";
import { qualificationTemplateVariables } from "@/features/qualification-turbo/approaches";
import { companyNameFor } from "@/features/qualification-turbo/service";
import { enqueueWahaAiReply } from "@/features/waha-cadence/service";
import { getDatabase, schema } from "@/shared/db";
import { withJobLease } from "@/shared/db/job-lease";
import { resolveSystemUserId } from "@/shared/tenant/system-user";

import { buildRecoveryText, decideRecoveryTouch, pendingAskFor, type RecoveryChannel, type RecoverySegment, type RecoveryStepDef } from "./cadence-rules";
import { getSystemSettings } from "@/features/system-settings/queries";

import { parseRecoverySettings, type RecoverySettings } from "./settings-core";
import { touchCostBrl } from "./touch-cost";

const TIME_BUDGET_MS = 40_000;
const LIMIT_PER_SEGMENT = 60;

export type RecoveryCadenceResult = { tenants: number; candidates: number; sent: number; skipped: number; finished: number; failed: number; waiting: number; reason?: string };

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as T[];
}

/** Templates aprovados de qualquer categoria na WABA ativa (S4–S6 são de marketing). */
async function approvedTemplates(tenantId: string) {
  const wabaId = await getActiveWabaId(tenantId);
  if (!wabaId) return new Set<string>();
  const rows = await getDatabase().select({ name: schema.metaWhatsAppTemplates.name }).from(schema.metaWhatsAppTemplates).where(and(
    eq(schema.metaWhatsAppTemplates.tenantId, tenantId),
    eq(schema.metaWhatsAppTemplates.wabaId, wabaId),
    eq(schema.metaWhatsAppTemplates.status, "APPROVED"),
    isNull(schema.metaWhatsAppTemplates.deletedAt),
  ));
  return new Set(rows.map((row) => row.name));
}

/** Empresas com a cadência nova pronta para sair: ligada, com segmento ligado e conferência jurídica registrada. */
async function readyTenants() {
  const settingsRows = await getSystemSettings().catch(() => []);
  const out: Array<{ tenantId: string; settings: RecoverySettings }> = [];
  for (const row of settingsRows) {
    if (!row.key.startsWith("lead_recovery_")) continue;
    const settings = parseRecoverySettings(row.value ?? null);
    if (settings.enabled && settings.legalReviewedAt && (settings.stoppedMidway || settings.warmBridge)) out.push({ tenantId: row.key.slice("lead_recovery_".length), settings });
  }
  return out;
}

/**
 * Cadência única de recuperação (fase 3). Roda dentro do job qualification-cadence (Coolify, a cada 2 min), depois
 * dos lembretes do turbo. DESLIGADA por padrão: só age em empresa com a recuperação ligada, um segmento ligado e a
 * conferência jurídica registrada. Cada toque é reservado na tabela 0234 antes do envio (dois runs nunca mandam o
 * mesmo passo); sem a tabela, não roda.
 */
export async function runRecoveryCadenceJob(now = new Date()): Promise<RecoveryCadenceResult | { skipped: "locked" }> {
  const lease = await withJobLease("lead-recovery-cadence", TIME_BUDGET_MS + 60_000, () => runRecoveryCadence(now));
  return lease.acquired ? lease.value : { skipped: "locked" as const };
}

async function runRecoveryCadence(now: Date): Promise<RecoveryCadenceResult> {
  const started = Date.now();
  const result: RecoveryCadenceResult = { tenants: 0, candidates: 0, sent: 0, skipped: 0, finished: 0, failed: 0, waiting: 0 };
  const tenants = await readyTenants();
  result.tenants = tenants.length;
  if (!tenants.length) return { ...result, reason: "off" };
  const db = getDatabase();
  try {
    await db.execute(sql`select 1 from lead_recovery_touches limit 1`);
  } catch {
    return { ...result, reason: "migration_0234_missing" };
  }

  for (const { tenantId, settings } of tenants) {
    const segments: RecoverySegment[] = [...(settings.stoppedMidway ? ["stopped_midway" as const] : []), ...(settings.warmBridge ? ["warm" as const] : [])];
    const [approved, empresa, qualification] = await Promise.all([
      approvedTemplates(tenantId),
      companyNameFor(tenantId),
      getQualificationTenantSettings(tenantId).catch(() => null),
    ]);
    const botName = qualification?.assistantName?.trim() || "Assistente";
    for (const segment of segments) {
      const candidates = segment === "stopped_midway" ? await stoppedMidwayCandidates(tenantId, now) : await warmCandidates(tenantId, now);
      result.candidates += candidates.length;
      for (const candidate of candidates) {
        if (Date.now() - started > TIME_BUDGET_MS) return result;
        try {
          const outcome = await processLead({ tenantId, settings, segment, leadId: candidate.lead_id, startAt: new Date(candidate.start_at), now, approved, empresa, botName });
          result[outcome] += 1;
        } catch (error) {
          result.failed += 1;
          console.error("[lead-recovery] lead_failed", { tenantId, leadId: candidate.lead_id, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
        }
      }
    }
  }
  return result;
}

/** R2: respondeu ao menos uma vez e a última mensagem é da IA, há 3 h a 8 dias. Sem corretor, sem marca de recuperação. */
async function stoppedMidwayCandidates(tenantId: string, now: Date) {
  const result = await getDatabase().execute(sql`
    with recent as (
      select o.lead_id, max(o.sent_at) as last_ai
      from whatsapp_messages o
      where o.tenant_id = ${tenantId} and o.lead_id is not null and o.direction = 'outbound' and o.sender_role = 'assistant'
        and o.sent_at between ${new Date(now.getTime() - 8 * 86_400_000).toISOString()}::timestamptz and ${new Date(now.getTime() - 3 * 3_600_000).toISOString()}::timestamptz
        and o.id not like 'recovery\\_%' and o.id not like 'ai\\_silence\\_followup\\_%'
      group by o.lead_id
    )
    select l.id as lead_id, r.last_ai as start_at
    from recent r
    join leads l on l.id = r.lead_id and l.tenant_id = ${tenantId}
    where l.deleted_at is null and l.archived_at is null and l.corretor_id is null
      and l.status not in ('lost', 'converted')
      and coalesce(l.qualification_status, 'pending') in ('pending', 'qualifying', 'cold')
      and l.qualification_details->'recovery'->>'state' is null
      and l.qualification_details->'recovery'->>'cadenceFinishedAt' is null
      and exists (select 1 from whatsapp_messages i where i.tenant_id = l.tenant_id and i.lead_id = l.id and i.direction in ('incoming', 'inbound'))
      and not exists (select 1 from whatsapp_messages i where i.tenant_id = l.tenant_id and i.lead_id = l.id and i.direction in ('incoming', 'inbound') and i.sent_at > r.last_ai)
    order by random()
    limit ${LIMIT_PER_SEGMENT}
  `);
  return rowsOf<{ lead_id: string; start_at: string }>(result);
}

/** R3: morno com corretor que ainda não fez o 1º contato, atribuído há 2 h a 2 dias. */
async function warmCandidates(tenantId: string, now: Date) {
  const result = await getDatabase().execute(sql`
    select l.id as lead_id, l.assigned_at as start_at
    from leads l
    where l.tenant_id = ${tenantId} and l.deleted_at is null and l.archived_at is null
      and l.qualification_status = 'warm' and l.corretor_id is not null and l.first_contact_at is null
      and l.status in ('distributed', 'new')
      and l.assigned_at between ${new Date(now.getTime() - 2 * 86_400_000).toISOString()}::timestamptz and ${new Date(now.getTime() - 2 * 3_600_000).toISOString()}::timestamptz
      and l.qualification_details->'recovery'->>'state' is null
      and l.qualification_details->'recovery'->>'cadenceFinishedAt' is null
    order by random()
    limit ${LIMIT_PER_SEGMENT}
  `);
  return rowsOf<{ lead_id: string; start_at: string }>(result);
}

async function processLead(input: {
  tenantId: string;
  settings: RecoverySettings;
  segment: RecoverySegment;
  leadId: string;
  startAt: Date;
  now: Date;
  approved: Set<string>;
  empresa: string;
  botName: string;
}): Promise<"sent" | "skipped" | "finished" | "failed" | "waiting"> {
  const db = getDatabase();
  const { tenantId, leadId } = input;
  const [lead] = await db.select({
    nome: schema.leads.nome,
    telefone: schema.leads.telefone,
    status: schema.leads.status,
    qualificationStatus: schema.leads.qualificationStatus,
    corretorId: schema.leads.corretorId,
    firstContactAt: schema.leads.firstContactAt,
    recovery: sql<unknown>`${schema.leads.qualificationDetails}->'recovery'`,
  }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId))).limit(1);
  if (!lead?.telefone) return "skipped";
  const [conversation] = await db.select({
    status: schema.aiConversations.status,
    automationState: schema.aiConversations.automationState,
    optOutAt: schema.aiConversations.optOutAt,
    wrongNumberAt: schema.aiConversations.wrongNumberAt,
    memory: schema.aiConversations.memory,
  }).from(schema.aiConversations).where(and(eq(schema.aiConversations.tenantId, tenantId), eq(schema.aiConversations.leadId, leadId)))
    .orderBy(desc(schema.aiConversations.updatedAt)).limit(1);
  const messages = await db.select({
    id: schema.whatsappMessages.id,
    direction: schema.whatsappMessages.direction,
    senderRole: schema.whatsappMessages.senderRole,
    provider: schema.whatsappMessages.provider,
    providerStatus: schema.whatsappMessages.providerStatus,
    sentAt: schema.whatsappMessages.sentAt,
  }).from(schema.whatsappMessages).where(and(eq(schema.whatsappMessages.tenantId, tenantId), eq(schema.whatsappMessages.leadId, leadId)))
    .orderBy(desc(schema.whatsappMessages.sentAt)).limit(40);
  const touches = await db.select({
    step: schema.leadRecoveryTouches.step,
    status: schema.leadRecoveryTouches.status,
    attempt: schema.leadRecoveryTouches.attempt,
    errorCode: schema.leadRecoveryTouches.errorCode,
    at: schema.leadRecoveryTouches.createdAt,
  }).from(schema.leadRecoveryTouches).where(and(eq(schema.leadRecoveryTouches.tenantId, tenantId), eq(schema.leadRecoveryTouches.leadId, leadId)));
  const [wahaRun] = await db.select({ id: schema.wahaCadenceRuns.id }).from(schema.wahaCadenceRuns)
    .where(and(eq(schema.wahaCadenceRuns.tenantId, tenantId), eq(schema.wahaCadenceRuns.recipientType, "lead"), eq(schema.wahaCadenceRuns.recipientId, leadId)))
    .orderBy(desc(schema.wahaCadenceRuns.createdAt)).limit(1);

  const isInbound = (direction: string) => direction === "incoming" || direction === "inbound";
  const inbound = messages.filter((message) => isInbound(message.direction) && message.sentAt);
  const lastInboundAt = inbound[0]?.sentAt ?? null;
  const lastMetaInboundAt = inbound.find((message) => !message.provider || message.provider === "meta" || message.provider === "meta_cloud")?.sentAt ?? null;
  const lastAi = messages.find((message) => !isInbound(message.direction) && message.senderRole === "assistant");
  const automatic = messages.filter((message) => !isInbound(message.direction) && message.sentAt && message.sentAt >= input.startAt && message.providerStatus !== "failed"
    && (message.id.startsWith("recovery_") || message.id.startsWith("ai_silence_followup_") || message.id.startsWith("qualification_turbo_")));
  const recovery = lead.recovery && typeof lead.recovery === "object" ? (lead.recovery as { state?: string }) : null;

  const decision = decideRecoveryTouch({
    now: input.now,
    settings: input.settings,
    segment: input.segment,
    leadId,
    lead: { status: lead.status, qualificationStatus: lead.qualificationStatus, corretorId: lead.corretorId, firstContactAt: lead.firstContactAt, recoveryState: recovery?.state ?? null },
    conversation: conversation ?? null,
    startAt: input.startAt,
    lastInboundAt,
    lastMetaInboundAt,
    conversationChannel: lastAi?.provider === "waha" ? "waha" : "meta",
    wahaAvailable: Boolean(wahaRun),
    touches: touches.map((touch) => ({ ...touch, at: touch.at })),
    automaticSentSinceStart: automatic.length,
    lastAutomaticAt: automatic[0]?.sentAt ?? null,
    approvedTemplates: input.approved,
  });

  if (decision.action === "wait" || decision.action === "stop") return "waiting";
  if (decision.action === "finished") {
    const marker = decision.next === "call_queue"
      ? { state: "call_queue", at: input.now.toISOString(), from: "cadence" }
      : { cadenceFinishedAt: input.now.toISOString() };
    await db.update(schema.leads).set({
      qualificationDetails: sql`jsonb_set(coalesce(${schema.leads.qualificationDetails}, '{}'::jsonb), '{recovery}', coalesce(${schema.leads.qualificationDetails}->'recovery', '{}'::jsonb) || ${JSON.stringify(marker)}::jsonb)`,
    }).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId)));
    await audit(tenantId, leadId, decision.next === "call_queue" ? "recovery.call_queue" : "recovery.cadence_finished");
    return "finished";
  }
  if (decision.action === "skip") {
    await claim(tenantId, leadId, input.segment, decision.step, 1, "skipped", decision.reason);
    return "skipped";
  }

  // Reserva o toque antes de enviar: dois runs nunca mandam o mesmo passo.
  const claimed = await claim(tenantId, leadId, input.segment, decision.step, decision.attempt, "held", null);
  if (!claimed) return "skipped";
  const sent = await sendStep({
    tenantId, leadId, phone: lead.telefone, step: decision.step, channels: [decision.channel, decision.fallback].filter((value): value is RecoveryChannel => Boolean(value)),
    wahaRunId: wahaRun?.id ?? null, attempt: decision.attempt,
    text: decision.step.kind === "free" ? buildRecoveryText(decision.step.id, { leadName: lead.nome, brokerName: input.segment === "warm" ? await brokerName(lead.corretorId) : null, pendingAsk: pendingAskFor(collectedOf(conversation?.memory)) }) : null,
    variables: qualificationTemplateVariables(lead.nome || "Cliente", input.botName, input.empresa, null),
  });
  await db.update(schema.leadRecoveryTouches).set({
    status: sent.ok ? "sent" : "failed",
    channel: sent.channel,
    template: decision.step.template ?? null,
    errorCode: sent.ok ? null : sent.errorCode,
    outboundId: sent.outboundId,
    messageId: sent.messageId,
    costBrl: String(sent.ok ? touchCostBrl(decision.step.kind === "template" ? "marketing" : "free", sent.channel) : 0),
  }).where(and(eq(schema.leadRecoveryTouches.id, claimed), eq(schema.leadRecoveryTouches.tenantId, tenantId)));
  await audit(tenantId, leadId, sent.ok ? `recovery.touch_sent:${decision.step.id}` : `recovery.touch_failed:${decision.step.id}`);
  return sent.ok ? "sent" : "failed";
}

function collectedOf(memory: unknown) {
  const fields = memory && typeof memory === "object" ? (memory as { collectedFields?: unknown }).collectedFields : null;
  return Array.isArray(fields) ? fields.filter((field): field is string => typeof field === "string") : [];
}

async function brokerName(userId: string | null) {
  if (!userId) return null;
  const [row] = await getDatabase().select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, userId)).limit(1);
  return row?.name ?? null;
}

async function claim(tenantId: string, leadId: string, segment: RecoverySegment, step: RecoveryStepDef, attempt: number, status: "held" | "skipped", reason: string | null) {
  const id = randomUUID();
  const [row] = await getDatabase().insert(schema.leadRecoveryTouches).values({
    id, tenantId, leadId, segment, step: step.id, attempt, status, reason, template: step.template ?? null,
    channel: step.kind === "template" ? "meta" : null,
    controlGroup: false,
  }).onConflictDoNothing().returning({ id: schema.leadRecoveryTouches.id });
  return row?.id ?? null;
}

async function audit(tenantId: string, leadId: string, acao: string) {
  await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId: await resolveSystemUserId(tenantId), entidade: "lead", entidadeId: leadId, acao, createdAt: new Date() }).catch(() => undefined);
}

type SendResult = { ok: true; channel: RecoveryChannel; outboundId: string | null; messageId: string | null } | { ok: false; channel: RecoveryChannel | null; errorCode: string; outboundId: string | null; messageId: null };

async function sendStep(input: { tenantId: string; leadId: string; phone: string; step: RecoveryStepDef; channels: RecoveryChannel[]; wahaRunId: string | null; attempt: number; text: string | null; variables: string[] }): Promise<SendResult> {
  const db = getDatabase();
  if (input.step.kind === "template") {
    try {
      const queued = await enqueueMetaTemplateMessage({
        tenantId: input.tenantId, recipientType: "lead", recipientId: input.leadId, destinationPhone: input.phone, purpose: "leadQualification",
        variables: input.variables, idempotencyKey: `lead-recovery:${input.leadId}:${input.step.id}:${input.attempt}`, requireApprovedMetaTemplate: true, templateName: input.step.template,
      });
      await processMetaOutboundBatch(1, input.tenantId, queued.id).catch(() => null);
      const [row] = await db.select({ status: schema.whatsappOutboundMessages.status, errorCode: schema.whatsappOutboundMessages.providerErrorCode, providerMessageId: schema.whatsappOutboundMessages.providerMessageId, renderedBody: schema.whatsappOutboundMessages.renderedBody, channelId: schema.whatsappOutboundMessages.channelId, destinationPhone: schema.whatsappOutboundMessages.destinationPhone })
        .from(schema.whatsappOutboundMessages).where(and(eq(schema.whatsappOutboundMessages.id, queued.id), eq(schema.whatsappOutboundMessages.tenantId, input.tenantId))).limit(1);
      if (row && ["sent", "delivered", "read"].includes(row.status)) {
        await db.insert(schema.whatsappMessages).values({
          id: row.providerMessageId || `recovery_${input.step.id}_${input.leadId}_${input.attempt}`, tenantId: input.tenantId, leadId: input.leadId,
          communicationChannelId: row.channelId ?? undefined, senderRole: "assistant", provider: "meta", phone: row.destinationPhone, direction: "outbound",
          body: row.renderedBody || "Lembrete da cotação de plano de saúde.", providerStatus: "sent", messageId: row.providerMessageId ?? undefined, sentAt: new Date(),
        }).onConflictDoNothing();
        return { ok: true, channel: "meta", outboundId: queued.id, messageId: row.providerMessageId ?? null };
      }
      if (row && ["queued", "pending"].includes(row.status)) {
        // Retida na fila de saída: cancela (poderia sair fora do horário) e tenta no próximo run.
        await db.update(schema.whatsappOutboundMessages).set({ status: "cancelled", updatedAt: new Date() })
          .where(and(eq(schema.whatsappOutboundMessages.id, queued.id), eq(schema.whatsappOutboundMessages.tenantId, input.tenantId), inArray(schema.whatsappOutboundMessages.status, ["queued", "pending"])));
        return { ok: false, channel: "meta", errorCode: "held", outboundId: queued.id, messageId: null };
      }
      return { ok: false, channel: "meta", errorCode: row?.errorCode ?? row?.status ?? "not_sent", outboundId: queued.id, messageId: null };
    } catch (error) {
      return { ok: false, channel: "meta", errorCode: error instanceof Error ? error.message.slice(0, 80) : "error", outboundId: null, messageId: null };
    }
  }

  for (const channel of input.channels) {
    try {
      let messageId: string;
      let communicationChannelId: string | null = null;
      if (channel === "waha") {
        if (!input.wahaRunId) throw new Error("waha_run_missing");
        messageId = await enqueueWahaAiReply({ tenantId: input.tenantId, runId: input.wahaRunId, body: input.text! });
      } else {
        const metaChannel = await getPreferredMetaCloudChannel({ tenantId: input.tenantId, leadId: input.leadId, customerPhone: input.phone });
        if (!metaChannel || "blocked" in metaChannel) throw new Error("meta_channel_unavailable");
        const to = (await resolveCanonicalWhatsAppDestination({ tenantId: input.tenantId, phone: input.phone, leadId: input.leadId })) ?? input.phone;
        const sent = await sendMetaCloudChannelText({ channel: metaChannel, to, body: input.text! });
        if (!sent.messageId) throw new Error("meta_not_sent");
        messageId = sent.messageId;
        communicationChannelId = metaChannel.id;
      }
      await db.insert(schema.whatsappMessages).values({
        id: `recovery_${input.step.id}_${input.leadId}_${input.attempt}`, tenantId: input.tenantId, leadId: input.leadId, communicationChannelId,
        senderRole: "assistant", provider: channel, phone: input.phone, direction: "outbound", body: input.text!, providerStatus: "sent", messageId, sentAt: new Date(),
      }).onConflictDoNothing();
      return { ok: true, channel, outboundId: null, messageId };
    } catch (error) {
      console.warn("[lead-recovery] channel_failed", { tenantId: input.tenantId, leadId: input.leadId, channel, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    }
  }
  return { ok: false, channel: input.channels[0] ?? null, errorCode: "all_channels_failed", outboundId: null, messageId: null };
}
