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
import { enterCallQueue, sweepTurboFinishedIntoCallQueue } from "./call-queue";
import { decideNurtureTouch, LOST_REASON_FOR_NURTURE, LOST_TO_NURTURE_DAYS, nextNurtureDate, NURTURE_TEMPLATE } from "./nurture-rules";
import { chooseStepVariant, stepVariantText } from "./step-experiments";
import { recoveryMarketingAllowed, recoveryUsableTemplates } from "./marketing-exception";

const TIME_BUDGET_MS = 40_000;
const LIMIT_PER_SEGMENT = 60;

export type RecoveryCadenceResult = { tenants: number; candidates: number; sent: number; skipped: number; finished: number; failed: number; waiting: number; toCallQueue: number; nurture?: number; replied?: number; reason?: string };

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as T[];
}

/**
 * Templates aprovados na WABA ativa, separados por categoria. A qualificação usa só Utility (DEC-155); a exceção da
 * recuperação (DEC-190) libera os Marketing da lista RECOVERY_MARKETING_TEMPLATES. Outro Marketing segue barrado.
 */
async function approvedTemplates(tenantId: string) {
  const wabaId = await getActiveWabaId(tenantId);
  if (!wabaId) return { utility: new Set<string>(), marketing: new Set<string>() };
  const rows = await getDatabase().select({ name: schema.metaWhatsAppTemplates.name, category: schema.metaWhatsAppTemplates.category }).from(schema.metaWhatsAppTemplates).where(and(
    eq(schema.metaWhatsAppTemplates.tenantId, tenantId),
    eq(schema.metaWhatsAppTemplates.wabaId, wabaId),
    eq(schema.metaWhatsAppTemplates.status, "APPROVED"),
    isNull(schema.metaWhatsAppTemplates.deletedAt),
  ));
  const utility = new Set(rows.filter((row) => (row.category ?? "").toUpperCase() === "UTILITY").map((row) => row.name));
  const marketing = new Set(rows.filter((row) => (row.category ?? "").toUpperCase() !== "UTILITY").map((row) => row.name));
  return { utility, marketing };
}

/** Empresas com a cadência nova pronta para sair: ligada, com segmento ligado e conferência jurídica registrada. */
async function readyTenants() {
  const settingsRows = await getSystemSettings().catch(() => []);
  const out: Array<{ tenantId: string; settings: RecoverySettings }> = [];
  for (const row of settingsRows) {
    if (!row.key.startsWith("lead_recovery_")) continue;
    const settings = parseRecoverySettings(row.value ?? null);
    if (settings.enabled && settings.legalReviewedAt && (settings.stoppedMidway || settings.warmBridge || settings.callQueue || settings.nurture)) out.push({ tenantId: row.key.slice("lead_recovery_".length), settings });
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
  const result: RecoveryCadenceResult = { tenants: 0, candidates: 0, sent: 0, skipped: 0, finished: 0, failed: 0, waiting: 0, toCallQueue: 0 };
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
    // Quem respondeu sai da fila de ligação e da nutrição e volta para a IA (conta como recuperado).
    result.replied = (result.replied ?? 0) + await clearRepliedMarks(tenantId, now).catch(() => 0);
    // Fase 4: quem terminou os lembretes do turbo sem responder vai para a fila de ligação.
    if (settings.callQueue) result.toCallQueue += await sweepTurboFinishedIntoCallQueue(tenantId, now).catch(() => 0);
    const segments: RecoverySegment[] = [...(settings.stoppedMidway ? ["stopped_midway" as const] : []), ...(settings.warmBridge ? ["warm" as const] : [])];
    const [approved, empresa, qualification] = await Promise.all([
      approvedTemplates(tenantId),
      companyNameFor(tenantId),
      getQualificationTenantSettings(tenantId).catch(() => null),
    ]);
    const botName = qualification?.assistantName?.trim() || "Assistente";
    // Fase 5: nutrição mensal (e o perdido por preço ou momento há 60 dias entra nela).
    if (settings.nurture) {
      await sweepLostIntoNurture(tenantId, now).catch(() => 0);
      result.nurture = (result.nurture ?? 0) + await runNurture({ tenantId, settings, now, approved, empresa, botName, deadline: started + TIME_BUDGET_MS }).catch((error) => {
        console.error("[lead-recovery] nurture_failed", { tenantId, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
        return 0;
      });
    }
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
  approved: { utility: Set<string>; marketing: Set<string> };
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
    // DEC-190: o runner só roda com a recuperação ligada e a conferência jurídica, então a exceção vale aqui.
    approvedTemplates: recoveryUsableTemplates({ utility: input.approved.utility, marketing: input.approved.marketing, allowed: recoveryMarketingAllowed(input.settings) }),
    marketingTemplates: input.approved.marketing,
  });

  if (decision.action === "wait" || decision.action === "stop") return "waiting";
  if (decision.action === "finished") {
    if (decision.next === "call_queue") {
      await enterCallQueue(tenantId, leadId, "cadence", input.now);
      return "finished";
    }
    await db.update(schema.leads).set({
      qualificationDetails: sql`jsonb_set(coalesce(${schema.leads.qualificationDetails}, '{}'::jsonb), '{recovery}', coalesce(${schema.leads.qualificationDetails}->'recovery', '{}'::jsonb) || ${JSON.stringify({ cadenceFinishedAt: input.now.toISOString() })}::jsonb)`,
    }).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId)));
    await audit(tenantId, leadId, "recovery.cadence_finished");
    return "finished";
  }
  if (decision.action === "skip") {
    await claim(tenantId, leadId, input.segment, decision.step, 1, "skipped", decision.reason);
    return "skipped";
  }

  // Reserva o toque antes de enviar: dois runs nunca mandam o mesmo passo.
  const claimed = await claim(tenantId, leadId, input.segment, decision.step, decision.attempt, "held", null);
  if (!claimed) return "skipped";
  // Fase 5: A/B por passo (hoje só o S2), Thompson quando ligado; desligado, a variante padrão.
  const variant = chooseStepVariant({ leadId, step: decision.step.id, enabled: input.settings.stepExperiments, stats: input.settings.stepExperiments ? await stepVariantStats(tenantId, decision.step.id) : [] });
  const baseText = decision.step.kind === "free" ? buildRecoveryText(decision.step.id, { leadName: lead.nome, brokerName: input.segment === "warm" ? await brokerName(lead.corretorId) : null, pendingAsk: pendingAskFor(collectedOf(conversation?.memory)) }) : null;
  const sent = await sendStep({
    tenantId, leadId, phone: lead.telefone, step: decision.step, channels: [decision.channel, decision.fallback].filter((value): value is RecoveryChannel => Boolean(value)),
    wahaRunId: wahaRun?.id ?? null, attempt: decision.attempt,
    text: baseText ? stepVariantText(decision.step.id, variant, baseText, lead.nome) : null,
    variables: qualificationTemplateVariables(lead.nome || "Cliente", input.botName, input.empresa, null),
  });
  await db.update(schema.leadRecoveryTouches).set({
    status: sent.ok ? "sent" : "failed",
    channel: sent.channel,
    template: variant ? `variante:${variant}` : decision.step.template ?? null,
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

async function claim(tenantId: string, leadId: string, segment: RecoverySegment | "nurture", step: RecoveryStepDef, attempt: number, status: "held" | "skipped", reason: string | null) {
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
        allowRecoveryMarketing: true,
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

/** Envios e respostas em 24 h por variante de um passo (para o Thompson). */
async function stepVariantStats(tenantId: string, step: string) {
  const result = await getDatabase().execute(sql`
    select r.template as variant,
      count(*) filter (where r.status = 'sent')::int as sent,
      count(*) filter (where r.status = 'sent' and exists (select 1 from whatsapp_messages i where i.tenant_id = r.tenant_id and i.lead_id = r.lead_id
        and i.direction in ('incoming', 'inbound') and i.sent_at > r.created_at and i.sent_at < r.created_at + interval '24 hours'))::int as replied
    from lead_recovery_touches r
    where r.tenant_id = ${tenantId} and r.step = ${step} and r.template like 'variante:%'
    group by r.template
  `);
  return rowsOf<{ variant: string; sent: number; replied: number }>(result).map((row) => ({ variant: row.variant.replace("variante:", ""), sent: Number(row.sent) || 0, replied: Number(row.replied) || 0 }));
}

/** Quem respondeu depois de entrar na fila de ligação ou na nutrição sai dela (a IA continua a conversa). */
async function clearRepliedMarks(tenantId: string, now: Date) {
  const result = await getDatabase().execute(sql`
    update leads l set qualification_details = jsonb_set(l.qualification_details, '{recovery}',
      ((l.qualification_details->'recovery') - 'state') || jsonb_build_object('repliedAt', ${now.toISOString()}::text, 'repliedFrom', l.qualification_details->'recovery'->>'state'))
    where l.tenant_id = ${tenantId} and l.deleted_at is null
      and l.qualification_details->'recovery'->>'state' in ('call_queue', 'nurture', 'bad_moment')
      and exists (select 1 from whatsapp_messages i where i.tenant_id = l.tenant_id and i.lead_id = l.id and i.direction in ('incoming', 'inbound')
        and i.sent_at > (l.qualification_details->'recovery'->>'at')::timestamptz)
    returning l.id
  `);
  const ids = rowsOf<{ id: string }>(result).map((row) => row.id);
  for (const id of ids) await audit(tenantId, id, "recovery.replied");
  return ids.length;
}

/** Perdido por preço ou momento há 60 dias (sem opt-out e sem marca) entra na nutrição (§4.3, N7 → R6). */
async function sweepLostIntoNurture(tenantId: string, now: Date) {
  const result = await getDatabase().execute(sql`
    update leads l set qualification_details = jsonb_set(coalesce(l.qualification_details, '{}'::jsonb), '{recovery}',
      jsonb_build_object('state', 'nurture', 'at', ${now.toISOString()}::text, 'until', ${now.toISOString()}::text, 'touches', 0, 'from', 'lost'))
    where l.tenant_id = ${tenantId} and l.deleted_at is null and l.archived_at is null and l.status = 'lost'
      and coalesce(l.stage_entered_at, l.created_at) <= ${new Date(now.getTime() - LOST_TO_NURTURE_DAYS * 86_400_000).toISOString()}::timestamptz
      and coalesce(l.stage_entered_at, l.created_at) >= ${new Date(now.getTime() - 365 * 86_400_000).toISOString()}::timestamptz
      and coalesce(l.motivo_perda, '') ~* ${LOST_REASON_FOR_NURTURE.source}
      and l.qualification_details->'recovery' is null
      and not exists (select 1 from ai_conversations c where c.tenant_id = l.tenant_id and c.lead_id = l.id and (c.opt_out_at is not null or c.wrong_number_at is not null))
    returning l.id
  `);
  const ids = rowsOf<{ id: string }>(result).map((row) => row.id);
  for (const id of ids) await audit(tenantId, id, "recovery.nurture:lost");
  return ids.length;
}

type NurtureRow = {
  id: string;
  nome: string | null;
  telefone: string;
  corretor_id: string | null;
  recovery: { state: "nurture" | "bad_moment"; at?: string; until?: string | null; touches?: number };
  last_in: string | null;
  opted_out: boolean;
};

/** Nutrição mensal: um template por mês, no máximo 3 (regras em nurture-rules.ts). */
async function runNurture(input: { tenantId: string; settings: RecoverySettings; now: Date; approved: { utility: Set<string>; marketing: Set<string> }; empresa: string; botName: string; deadline: number }) {
  const db = getDatabase();
  const { tenantId, now } = input;
  const result = await db.execute(sql`
    select l.id, l.nome, l.telefone, l.corretor_id, l.qualification_details->'recovery' as recovery,
      (select max(i.sent_at) from whatsapp_messages i where i.tenant_id = l.tenant_id and i.lead_id = l.id and i.direction in ('incoming', 'inbound')) as last_in,
      exists (select 1 from ai_conversations c where c.tenant_id = l.tenant_id and c.lead_id = l.id and (c.opt_out_at is not null or c.wrong_number_at is not null)) as opted_out
    from leads l
    where l.tenant_id = ${tenantId} and l.deleted_at is null and l.archived_at is null and l.telefone is not null
      and l.qualification_details->'recovery'->>'state' in ('nurture', 'bad_moment')
      and coalesce((l.qualification_details->'recovery'->>'until')::timestamptz, ${now.toISOString()}::timestamptz) <= ${now.toISOString()}::timestamptz
    limit 60
  `);
  let sent = 0;
  for (const row of rowsOf<NurtureRow>(result)) {
    if (Date.now() > input.deadline) break;
    const touches = Number(row.recovery.touches) || 0;
    const decision = decideNurtureTouch({
      now, settings: input.settings, leadId: row.id,
      nurture: { state: row.recovery.state, at: new Date(row.recovery.at ?? now.toISOString()), until: row.recovery.until ? new Date(row.recovery.until) : null, touches },
      lastInboundAt: row.last_in ? new Date(row.last_in) : null, optedOut: Boolean(row.opted_out), hasBroker: Boolean(row.corretor_id), approvedTemplates: recoveryUsableTemplates({ utility: input.approved.utility, marketing: input.approved.marketing, allowed: recoveryMarketingAllowed(input.settings) }), marketingTemplates: input.approved.marketing,
    });
    const update = (value: Record<string, unknown>) => db.update(schema.leads).set({
      qualificationDetails: sql`jsonb_set(coalesce(${schema.leads.qualificationDetails}, '{}'::jsonb), '{recovery}', coalesce(${schema.leads.qualificationDetails}->'recovery', '{}'::jsonb) || ${JSON.stringify(value)}::jsonb)`,
    }).where(and(eq(schema.leads.id, row.id), eq(schema.leads.tenantId, tenantId)));
    if (decision.action === "wait" || decision.action === "stop" || decision.action === "replied") continue;
    if (decision.action === "finished") {
      await db.update(schema.leads).set({
        qualificationDetails: sql`jsonb_set(coalesce(${schema.leads.qualificationDetails}, '{}'::jsonb), '{recovery}', ((${schema.leads.qualificationDetails}->'recovery') - 'state') || ${JSON.stringify({ nurtureFinishedAt: now.toISOString() })}::jsonb)`,
      }).where(and(eq(schema.leads.id, row.id), eq(schema.leads.tenantId, tenantId)));
      await audit(tenantId, row.id, "recovery.nurture_finished");
      continue;
    }
    const step: RecoveryStepDef = { id: decision.step as RecoveryStepDef["id"], segment: "stopped_midway", afterMinutes: 0, kind: "template", template: NURTURE_TEMPLATE };
    if (decision.action === "skip") {
      await claim(tenantId, row.id, "nurture", step, 1, "skipped", decision.reason);
      await update({ touches: touches + 1, until: nextNurtureDate(now).toISOString() });
      continue;
    }
    const claimed = await claim(tenantId, row.id, "nurture", step, 1, "held", null);
    if (!claimed) continue;
    const outcome = await sendStep({ tenantId, leadId: row.id, phone: row.telefone, step, channels: ["meta"], wahaRunId: null, attempt: 1, text: null, variables: qualificationTemplateVariables(row.nome || "Cliente", input.botName, input.empresa, null) });
    await db.update(schema.leadRecoveryTouches).set({ status: outcome.ok ? "sent" : "failed", channel: "meta", errorCode: outcome.ok ? null : outcome.errorCode, outboundId: outcome.outboundId, messageId: outcome.messageId, costBrl: String(outcome.ok ? touchCostBrl("marketing", "meta") : 0) })
      .where(and(eq(schema.leadRecoveryTouches.id, claimed), eq(schema.leadRecoveryTouches.tenantId, tenantId)));
    await update({ touches: touches + 1, until: nextNurtureDate(now).toISOString(), lastTouchAt: now.toISOString() });
    await audit(tenantId, row.id, outcome.ok ? `recovery.nurture_sent:${decision.step}` : `recovery.nurture_failed:${decision.step}`);
    if (outcome.ok) sent += 1;
  }
  return sent;
}
