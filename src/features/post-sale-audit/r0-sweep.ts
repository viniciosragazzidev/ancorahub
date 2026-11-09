import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, notInArray, sql } from "drizzle-orm";

import { enqueueMetaTextMessage, enqueuePostSaleSurveyWahaMessage } from "@/features/communication-channels/outbound-service";
import { loadCustomerWaitingLeads } from "@/features/customer-waiting/queries";
import { getFeatureFlag, getSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { withJobLease } from "@/shared/db/job-lease";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { businessMillisecondsBetween, isWithinBusinessHours } from "@/shared/time/business-hours";

import { ensurePostSaleSurveyAlerts } from "./alert-service";
import { decideR0Trigger, parseR0Settings, postSaleR0SettingKey, R0_DEFAULTS, R0_ELIGIBLE_STATUSES, R0_RULE_KEY, r0EscalationState, readR0State, renderR0Opening, type R0SkipReason } from "./r0-rules";
import { firstName, isPostSaleWahaNumberAllowed } from "./rules";

export type PostSaleR0SweepResult = {
  tenants: number;
  waiting: number;
  started: number;
  skipped: Partial<Record<R0SkipReason | "already_started" | "enqueue_failed", number>>;
  escalated: number;
  resolved: number;
  recovered?: { retried: number; released: number };
  lease?: "busy";
};

const INBOUND = ["incoming", "inbound"] as const;
const HUMAN_REPLY = sql`(${schema.whatsappMessages.direction} = 'outgoing' or (${schema.whatsappMessages.direction} = 'outbound' and coalesce(${schema.whatsappMessages.senderRole}, '') not in ('assistant', 'system')))`;
const CANDIDATE_LIMIT = 500;

/** "2026-11-09" no fuso de São Paulo: a campanha automática da R0 é uma por dia e por empresa. */
function saoPauloDay(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Sem ":" (a chave do outbox `post-sale:<campanha>:<lead>` é separada por ":"). */
export function r0CampaignId(tenantId: string, now: Date) {
  return `post-sale-r0-${createHash("sha256").update(`${tenantId}|${saoPauloDay(now)}`).digest("hex").slice(0, 24)}`;
}

/** Um survey por lead e mensagem que disparou: rodar a varredura duas vezes não cria outro. */
export function r0SurveyId(tenantId: string, leadId: string, triggerMessageId: string) {
  return `post-sale-r0-${createHash("sha256").update(`${tenantId}|${leadId}|${triggerMessageId}`).digest("hex").slice(0, 32)}`;
}

function bump(result: PostSaleR0SweepResult, reason: R0SkipReason | "already_started" | "enqueue_failed") {
  result.skipped[reason] = (result.skipped[reason] ?? 0) + 1;
}

/**
 * Regra R0 do pós-venda: cliente que volta a escrever depois de distribuído. Roda dentro do job
 * do "cliente aguardando corretor" (a cada 5 min). Para cada empresa com a R0 ligada, acha os
 * leads das filas do piloto cujo cliente está esperando uma pessoa, aplica as proteções e puxa a
 * conversa pelo mesmo canal em que o cliente escreveu. Depois faz a escalada: resposta do cliente
 * sem retorno da equipe em 15 min úteis vira alerta para a direção e o gestor da unidade.
 * Nunca avisa o corretor (pedido de 09/11).
 */
/**
 * Recovery (Vigia, 09/11): an R0 survey stored as "queued" without an outbound message means the process
 * stopped between the insert and the enqueue. After 2 min it is retried with the same outbox key (never a
 * second message); if the client's 24 h window or the channel is gone, the survey is marked "failed" so it
 * no longer blocks the lead (active survey / 7-day cooldown).
 */
async function recoverStuckR0Surveys(tenantId: string, now: Date) {
  const db = getDatabase();
  const stuck = await db.select({
    id: schema.postSaleSurveys.id,
    campaignId: schema.postSaleSurveys.campaignId,
    leadId: schema.postSaleSurveys.leadId,
    phone: schema.postSaleSurveys.phone,
    channelType: schema.postSaleSurveys.channelType,
    channelRef: schema.postSaleSurveys.channelRef,
    createdAt: schema.postSaleSurveys.createdAt,
    answers: schema.postSaleSurveys.answers,
  }).from(schema.postSaleSurveys).where(and(
    eq(schema.postSaleSurveys.tenantId, tenantId),
    eq(schema.postSaleSurveys.ruleKey, R0_RULE_KEY),
    eq(schema.postSaleSurveys.status, "queued"),
    isNull(schema.postSaleSurveys.outboundId),
    lt(schema.postSaleSurveys.createdAt, new Date(now.getTime() - 2 * 60_000)),
  )).limit(20);
  let retried = 0;
  let released = 0;
  for (const survey of stuck) {
    const release = async (reason: string) => {
      await db.update(schema.postSaleSurveys).set({ status: "failed", skipReason: reason })
        .where(and(eq(schema.postSaleSurveys.id, survey.id), eq(schema.postSaleSurveys.tenantId, tenantId), eq(schema.postSaleSurveys.status, "queued"), isNull(schema.postSaleSurveys.outboundId)));
      released += 1;
    };
    // Free text only inside the client's 24 h window (R0 never uses a template).
    if (now.getTime() - survey.createdAt.getTime() > 20 * 60 * 60_000 || !survey.channelType || !survey.channelRef) {
      await release("envio interrompido; janela do cliente fechada");
      continue;
    }
    try {
      const r0 = (survey.answers as { r0?: { opening?: unknown } } | null)?.r0;
      const body = typeof r0?.opening === "string" ? r0.opening : null;
      if (!body) { await release("envio interrompido; texto de abertura indisponível"); continue; }
      const systemUserId = await resolveSystemUserId(tenantId);
      const idempotencyKey = `post-sale:${survey.campaignId}:${survey.leadId}`;
      const outbound = survey.channelType === "waha"
        ? await enqueuePostSaleSurveyWahaMessage({ tenantId, leadId: survey.leadId, wahaNumberId: survey.channelRef, destinationPhone: survey.phone, body, requestedBy: systemUserId, idempotencyKey })
        : await enqueueMetaTextMessage({ tenantId, channelId: survey.channelRef, recipientType: "lead", recipientId: survey.leadId, destinationPhone: survey.phone, body, requestedBy: systemUserId, purpose: "postSaleSurvey", idempotencyKey });
      const failed = ["failed", "cancelled", "expired", "skipped"].includes(outbound.status);
      await db.update(schema.postSaleSurveys).set({ outboundId: outbound.id, ...(failed ? { status: "failed", skipReason: "falha ao reenviar a abertura" } : {}) })
        .where(and(eq(schema.postSaleSurveys.id, survey.id), eq(schema.postSaleSurveys.tenantId, tenantId)));
      retried += 1;
    } catch (error) {
      console.warn("[post-sale-r0] recovery_failed", { tenantId, surveyId: survey.id, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
      await release("envio interrompido; canal indisponível");
    }
  }
  return { retried, released };
}

export async function runPostSaleR0Sweep(now = new Date()): Promise<PostSaleR0SweepResult> {
  const empty: PostSaleR0SweepResult = { tenants: 0, waiting: 0, started: 0, skipped: {}, escalated: 0, resolved: 0 };
  if (await getFeatureFlag(FEATURE_FLAGS.POST_SALE_AUDIT).catch(() => "false") !== "true") return empty;
  const leased = await withJobLease("post-sale-r0", 110_000, // under the route maxDuration (120 s): a timed-out run never blocks the next one (Vigia)
    () => sweepAllTenants(now));
  return leased.acquired ? leased.value : { ...empty, lease: "busy" };
}

async function sweepAllTenants(now: Date): Promise<PostSaleR0SweepResult> {
  const db = getDatabase();
  const result: PostSaleR0SweepResult = { tenants: 0, waiting: 0, started: 0, skipped: {}, escalated: 0, resolved: 0 };
  const tenants = await db.select({ id: schema.tenants.id, name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.status, "active"));
  for (const tenant of tenants) {
    const settings = parseR0Settings(await getSystemSetting(postSaleR0SettingKey(tenant.id)).catch(() => null));
    // Envio interrompido entre a gravação e a fila: tenta de novo ou libera o lead (Vigia, 09/11).
    const recovered = await recoverStuckR0Surveys(tenant.id, now).catch(() => null);
    if (recovered && (recovered.retried || recovered.released)) {
      result.recovered = { retried: (result.recovered?.retried ?? 0) + recovered.retried, released: (result.recovered?.released ?? 0) + recovered.released };
    }
    // Escalada roda mesmo com a R0 desligada depois: uma conversa já iniciada não fica sem dono.
    await escalateTenant(tenant.id, now, result).catch((error) => console.error("[post-sale-r0] escalation_failed", { tenantId: tenant.id, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" }));
    if (!settings.enabled || !settings.queueIds.length) continue;
    result.tenants += 1;
    await startTenant({ id: tenant.id, name: tenant.name }, settings, now, result).catch((error) => console.error("[post-sale-r0] tenant_failed", { tenantId: tenant.id, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" }));
  }
  return result;
}

async function startTenant(tenant: { id: string; name: string | null }, settings: ReturnType<typeof parseR0Settings>, now: Date, result: PostSaleR0SweepResult) {
  const db = getDatabase();
  const candidates = await db.select({
    id: schema.leads.id,
    name: schema.leads.nome,
    phone: schema.leads.telefone,
    tipo: schema.leads.tipo,
    status: schema.leads.status,
    distributionStatus: schema.leads.distributionStatus,
    queueId: schema.leads.queueId,
    brokerId: schema.leads.corretorId,
    branchId: sql<string | null>`coalesce(${schema.leads.branchId}, ${schema.leadQueues.branchId})`,
    ownerRole: schema.tenantMemberships.role,
    brokerName: schema.user.name,
  })
    .from(schema.leads)
    .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.leads.queueId), eq(schema.leadQueues.tenantId, schema.leads.tenantId)))
    .leftJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.leads.corretorId), eq(schema.tenantMemberships.tenantId, schema.leads.tenantId)))
    .leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId))
    .where(and(
      eq(schema.leads.tenantId, tenant.id),
      inArray(schema.leads.queueId, settings.queueIds),
      inArray(schema.leads.status, [...R0_ELIGIBLE_STATUSES]),
      eq(schema.leads.distributionStatus, "assigned"),
      isNotNull(schema.leads.corretorId),
      isNull(schema.leads.archivedAt),
      isNull(schema.leads.deletedAt),
    ))
    .limit(CANDIDATE_LIMIT);
  if (!candidates.length) return;

  const waiting = await loadCustomerWaitingLeads({ tenantId: tenant.id, now, lookbackDays: 2, leadIds: candidates.map((lead) => lead.id) });
  result.waiting += waiting.length;
  if (!waiting.length) return;
  const byId = new Map(candidates.map((lead) => [lead.id, lead]));
  const withinBusinessHours = isWithinBusinessHours(now);
  let systemUserId: string | null = null;
  let assistantName: string | null = null;

  for (const entry of waiting) {
    const lead = byId.get(entry.leadId);
    if (!lead) continue;
    const [trigger] = await db.select({
      id: schema.whatsappMessages.id,
      sentAt: schema.whatsappMessages.sentAt,
      provider: schema.whatsappMessages.provider,
      communicationChannelId: schema.whatsappMessages.communicationChannelId,
      wahaNumberId: schema.whatsappMessages.wahaNumberId,
      whatsappConnectionId: schema.whatsappMessages.whatsappConnectionId,
    }).from(schema.whatsappMessages).where(and(
      eq(schema.whatsappMessages.tenantId, tenant.id),
      eq(schema.whatsappMessages.leadId, lead.id),
      inArray(schema.whatsappMessages.direction, [...INBOUND]),
    )).orderBy(desc(schema.whatsappMessages.sentAt)).limit(1);
    if (!trigger) continue;
    const [lastHuman] = await db.select({ at: schema.whatsappMessages.sentAt, body: schema.whatsappMessages.body })
      .from(schema.whatsappMessages)
      .where(and(eq(schema.whatsappMessages.tenantId, tenant.id), eq(schema.whatsappMessages.leadId, lead.id), HUMAN_REPLY))
      .orderBy(desc(schema.whatsappMessages.sentAt)).limit(1);
    const [optOut] = await db.select({ id: schema.postSaleOptOuts.id }).from(schema.postSaleOptOuts)
      .where(and(eq(schema.postSaleOptOuts.tenantId, tenant.id), eq(schema.postSaleOptOuts.leadId, lead.id))).limit(1);
    const [conversationOptOut] = await db.select({ id: schema.aiConversations.id }).from(schema.aiConversations)
      .where(and(eq(schema.aiConversations.tenantId, tenant.id), eq(schema.aiConversations.leadId, lead.id), isNotNull(schema.aiConversations.optOutAt))).limit(1);
    const [activeSurvey] = await db.select({ id: schema.postSaleSurveys.id }).from(schema.postSaleSurveys).where(and(
      eq(schema.postSaleSurveys.tenantId, tenant.id),
      eq(schema.postSaleSurveys.leadId, lead.id),
      inArray(schema.postSaleSurveys.status, ["queued", "sent", "answering"]),
      gte(schema.postSaleSurveys.createdAt, new Date(now.getTime() - 5 * 86_400_000)),
    )).limit(1);
    const [lastR0] = await db.select({ createdAt: schema.postSaleSurveys.createdAt }).from(schema.postSaleSurveys).where(and(
      eq(schema.postSaleSurveys.tenantId, tenant.id),
      eq(schema.postSaleSurveys.leadId, lead.id),
      eq(schema.postSaleSurveys.ruleKey, R0_RULE_KEY),
      notInArray(schema.postSaleSurveys.status, ["failed", "skipped"]),
    )).orderBy(desc(schema.postSaleSurveys.createdAt)).limit(1);
    const source = await resolveTriggerSource(tenant.id, lead.branchId, trigger);

    const decision = decideR0Trigger({
      settings,
      lead: { status: lead.status, distributionStatus: lead.distributionStatus, queueId: lead.queueId, brokerId: lead.brokerId, ownerRole: lead.ownerRole },
      waiting: { waitingBusinessMinutes: entry.assessment.waitingBusinessMinutes, lastCustomerMessageAt: entry.assessment.lastCustomerMessageAt },
      lastHumanReply: lastHuman ? { at: lastHuman.at, body: lastHuman.body } : null,
      now,
      withinBusinessHours,
      activeSurvey: Boolean(activeSurvey),
      optedOut: Boolean(optOut || conversationOptOut),
      lastR0At: lastR0?.createdAt ?? null,
      sourceAvailable: Boolean(source),
    });
    if (!decision.fire) {
      bump(result, decision.skip);
      continue;
    }
    if (!source || !lead.brokerId) continue;

    systemUserId ??= await resolveSystemUserId(tenant.id);
    if (assistantName === null) {
      const [config] = await db.select({ assistantName: schema.aiQualificationConfigs.assistantName }).from(schema.aiQualificationConfigs).where(eq(schema.aiQualificationConfigs.tenantId, tenant.id)).limit(1);
      assistantName = config?.assistantName?.trim() || "assistente";
    }
    const opening = renderR0Opening({ lead: firstName(lead.name), broker: firstName(lead.brokerName), assistant: assistantName, company: tenant.name?.trim() || "nossa equipe", leadType: lead.tipo });
    const campaignId = await ensureR0Campaign(tenant.id, systemUserId, now);
    const surveyId = r0SurveyId(tenant.id, lead.id, trigger.id);
    const [inserted] = await db.insert(schema.postSaleSurveys).values({
      id: surveyId,
      tenantId: tenant.id,
      campaignId,
      leadId: lead.id,
      brokerId: lead.brokerId,
      phone: lead.phone,
      status: "queued",
      step: 0,
      // The opening text is kept so an interrupted send can be retried with the same words.
      answers: { r0: { trigger: decision.reason, triggerMessageId: trigger.id, opening } },
      channelType: source.type,
      channelRef: source.ref,
      ruleKey: R0_RULE_KEY,
      createdAt: now,
    }).onConflictDoNothing().returning({ id: schema.postSaleSurveys.id });
    if (!inserted) {
      bump(result, "already_started");
      continue;
    }

    const idempotencyKey = `post-sale:${campaignId}:${lead.id}`;
    try {
      const outbound = source.type === "waha"
        ? await enqueuePostSaleSurveyWahaMessage({ tenantId: tenant.id, leadId: lead.id, wahaNumberId: source.ref, destinationPhone: lead.phone, body: opening, requestedBy: systemUserId, idempotencyKey })
        : await enqueueMetaTextMessage({ tenantId: tenant.id, channelId: source.ref, recipientType: "lead", recipientId: lead.id, destinationPhone: lead.phone, body: opening, requestedBy: systemUserId, purpose: "postSaleSurvey", idempotencyKey });
      const failed = ["failed", "cancelled", "expired"].includes(outbound.status);
      await db.update(schema.postSaleSurveys).set({
        outboundId: outbound.id,
        ...(failed ? { status: "failed", skipReason: "falha ao enfileirar o canal de origem" } : outbound.status === "skipped" ? { status: "skipped", skipReason: "número de origem indisponível" } : {}),
      }).where(and(eq(schema.postSaleSurveys.id, surveyId), eq(schema.postSaleSurveys.tenantId, tenant.id)));
      if (failed || outbound.status === "skipped") {
        bump(result, "enqueue_failed");
        continue;
      }
    } catch (error) {
      await db.update(schema.postSaleSurveys).set({ status: "skipped", skipReason: "número de origem indisponível" })
        .where(and(eq(schema.postSaleSurveys.id, surveyId), eq(schema.postSaleSurveys.tenantId, tenant.id)));
      console.warn("[post-sale-r0] enqueue_failed", { tenantId: tenant.id, leadId: lead.id, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
      bump(result, "enqueue_failed");
      continue;
    }

    await db.update(schema.postSaleCampaigns).set({
      totals: sql`jsonb_set(coalesce(${schema.postSaleCampaigns.totals}, '{}'::jsonb), '{queued}', to_jsonb(coalesce((${schema.postSaleCampaigns.totals}->>'queued')::int, 0) + 1))`,
    }).where(and(eq(schema.postSaleCampaigns.id, campaignId), eq(schema.postSaleCampaigns.tenantId, tenant.id)));
    // No timeline note: the broker reads the lead timeline (Vinicios, 09/11). Audit log below keeps the trail.
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: systemUserId,
      entidade: "lead",
      entidadeId: lead.id,
      acao: "post_sale.r0.started",
      metadata: { surveyId, campaignId, trigger: decision.reason, channelType: source.type, waitingBusinessMinutes: entry.assessment.waitingBusinessMinutes },
      createdAt: now,
    });
    result.started += 1;
  }
}

type TriggerMessage = { provider: string; communicationChannelId: string | null; wahaNumberId: string | null; whatsappConnectionId: string | null };

/**
 * Mesmo canal em que o cliente escreveu: número oficial Meta da empresa (compartilhado, sem dono)
 * ou WAHA da empresa permitido para a unidade do lead. WhatsApp pessoal do corretor não serve.
 */
async function resolveTriggerSource(tenantId: string, leadBranchId: string | null, message: TriggerMessage): Promise<{ type: "meta" | "waha"; ref: string } | null> {
  if (message.whatsappConnectionId) return null;
  const db = getDatabase();
  if (message.communicationChannelId) {
    const [channel] = await db.select({ id: schema.communicationChannels.id, provider: schema.communicationChannels.provider, channelType: schema.communicationChannels.channelType, ownerUserId: schema.communicationChannels.ownerUserId, status: schema.communicationChannels.status })
      .from(schema.communicationChannels)
      .where(and(eq(schema.communicationChannels.id, message.communicationChannelId), eq(schema.communicationChannels.tenantId, tenantId))).limit(1);
    if (channel && channel.provider === "meta_cloud" && channel.channelType === "shared" && !channel.ownerUserId && channel.status === "active") return { type: "meta", ref: channel.id };
    return null;
  }
  if (message.wahaNumberId) {
    const [number] = await db.select({ id: schema.wahaNumbers.id, scope: schema.wahaNumbers.scope, branchId: schema.wahaNumbers.branchId, status: schema.wahaNumbers.status })
      .from(schema.wahaNumbers)
      .where(and(eq(schema.wahaNumbers.id, message.wahaNumberId), eq(schema.wahaNumbers.tenantId, tenantId))).limit(1);
    if (number && ["active", "ready"].includes(number.status) && isPostSaleWahaNumberAllowed(number, leadBranchId)) return { type: "waha", ref: number.id };
  }
  return null;
}

async function ensureR0Campaign(tenantId: string, createdBy: string, now: Date) {
  const id = r0CampaignId(tenantId, now);
  const [day, month, year] = [saoPauloDay(now).slice(8, 10), saoPauloDay(now).slice(5, 7), saoPauloDay(now).slice(0, 4)];
  await getDatabase().insert(schema.postSaleCampaigns).values({
    id,
    tenantId,
    name: `Cliente voltou a escrever ${day}/${month}/${year}`,
    audience: { kind: "rule", ruleKey: R0_RULE_KEY },
    kind: "auto",
    ruleKey: R0_RULE_KEY,
    openingMessage: "Oi, {{nome}}! Aqui é a {{assistente}}, da equipe de qualidade da {{empresa}}. Vi que você já conversou com {{corretor}}. Me conta o que rolou: você chegou a ser atendido e recebeu a cotação?",
    createdBy,
    status: "running",
    totals: {},
    createdAt: now,
    startedAt: now,
  }).onConflictDoNothing();
  return id;
}

/**
 * Depois da resposta do cliente nos casos que pedem retorno (não atendido, quer algo, outro
 * assunto): se alguém da empresa respondeu, marca como resolvido; se passaram 15 min úteis, escala
 * para a direção e o gestor da unidade. O lead não é tirado do corretor: a distribuição nunca
 * move um lead já aceito (mesma regra do SLA); repassar fica com a direção pelo alerta.
 */
async function escalateTenant(tenantId: string, now: Date, result: PostSaleR0SweepResult) {
  const db = getDatabase();
  const pending = await db.select().from(schema.postSaleSurveys).where(and(
    eq(schema.postSaleSurveys.tenantId, tenantId),
    eq(schema.postSaleSurveys.ruleKey, R0_RULE_KEY),
    eq(schema.postSaleSurveys.status, "completed"),
    gt(schema.postSaleSurveys.completedAt, new Date(now.getTime() - 3 * 86_400_000)),
    sql`${schema.postSaleSurveys.answers}->'r0'->>'awaitsTeam' = 'true'`,
    sql`${schema.postSaleSurveys.answers}->'r0'->>'escalatedAt' is null`,
    sql`${schema.postSaleSurveys.answers}->'r0'->>'resolvedAt' is null`,
  )).limit(200);
  for (const survey of pending) {
    const state = readR0State(survey.answers);
    const answeredAt = state.answeredAt ? new Date(state.answeredAt) : survey.lastReplyAt;
    if (!answeredAt || !Number.isFinite(answeredAt.getTime())) continue;
    const [reply] = await db.select({ at: schema.whatsappMessages.sentAt }).from(schema.whatsappMessages).where(and(
      eq(schema.whatsappMessages.tenantId, tenantId),
      eq(schema.whatsappMessages.leadId, survey.leadId),
      gt(schema.whatsappMessages.sentAt, answeredAt),
      HUMAN_REPLY,
    )).orderBy(desc(schema.whatsappMessages.sentAt)).limit(1);
    const verdict = r0EscalationState({ answeredAt, humanReplyAt: reply?.at ?? null, businessMsSinceAnswer: businessMillisecondsBetween(answeredAt, now), escalationMinutes: R0_DEFAULTS.escalationMinutes });
    if (verdict === "wait") continue;
    const field = verdict === "resolved" ? "resolvedAt" : "escalatedAt";
    const [updated] = await db.update(schema.postSaleSurveys).set({
      answers: sql`jsonb_set(${schema.postSaleSurveys.answers}, ${`{r0,${field}}`}::text[], to_jsonb(${now.toISOString()}::text))`,
      ...(verdict === "escalate" ? { alertsHandledAt: null } : {}),
    }).where(and(
      eq(schema.postSaleSurveys.id, survey.id),
      eq(schema.postSaleSurveys.tenantId, tenantId),
      sql`${schema.postSaleSurveys.answers}->'r0'->>'escalatedAt' is null`,
      sql`${schema.postSaleSurveys.answers}->'r0'->>'resolvedAt' is null`,
    )).returning();
    if (!updated) continue;
    if (verdict === "resolved") {
      result.resolved += 1;
      continue;
    }
    result.escalated += 1;
    await ensurePostSaleSurveyAlerts(updated);
    const userId = await resolveSystemUserId(tenantId);
    // No timeline note (hidden from the broker); the alert to direction/manager and the audit log carry it.
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId,
      entidade: "post_sale_survey",
      entidadeId: survey.id,
      acao: "post_sale.r0.escalated",
      metadata: { leadId: survey.leadId, brokerId: survey.brokerId, category: state.category ?? null },
      createdAt: now,
    });
  }
}

/** Flag e configuração da R0 lidas para a tela (diretor edita, gestor só vê). */
export async function readPostSaleR0Settings(tenantId: string) {
  return parseR0Settings(await getSystemSetting(postSaleR0SettingKey(tenantId)).catch(() => null));
}

