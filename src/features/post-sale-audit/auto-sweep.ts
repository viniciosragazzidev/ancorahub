import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";

import { enqueueMetaTemplateMessage, enqueuePostSaleSurveyWahaMessage } from "@/features/communication-channels/outbound-service";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { isBusinessHours, nextBusinessOpening } from "@/features/team-notices/guard";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { withJobLease } from "@/shared/db/job-lease";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { resolveSystemUserId } from "@/shared/tenant/system-user";

import { resolvePostSaleAudience, type PostSaleRecipient } from "./audience";
import {
  addBusinessDaysToDateKey,
  AUTO_RULE_DEFINITIONS,
  AUTO_RULE_KEYS,
  AUTO_RULE_LIMITS,
  AUTO_RULE_OPEN_STATUSES,
  AUTO_RULE_SKIP_LABELS,
  autoRuleMilestoneFloor,
  autoRuleRemainingCapacity,
  decideAutoRuleCandidate,
  effectiveAutoRuleDailyLimit,
  saoPauloDateKey,
  type AutoRuleKey,
  type AutoRuleSettings,
  type AutoRuleSkipReason,
} from "./auto-rules";
import { autoRuleCampaignId, autoRuleSurveyId } from "./auto-rule-ids";
import { loadAutoRules, loadTenantsWithEnabledAutoRules } from "./auto-rules-store";
import { firstName, POST_SALE_EXCLUSION_LABELS, renderPostSaleOpeningMessage, type PostSaleExclusionReason } from "./rules";
import { POST_SALE_META_TEMPLATE, POST_SALE_WAHA_OPENING_DEFAULT } from "./template-contract";

const CANDIDATE_LIMIT = 1000;
const AUDIENCE_CHUNK = 400;
/** Conta para o limite do dia: tudo que foi ou vai ser enviado (falha e ignorado não contam). */
const COUNTED_STATUSES = ["queued", "sent", "answering", "completed", "no_reply", "opted_out"];

type AutoRuleRecipient = PostSaleRecipient & { milestoneAt: Date };

export type AutoRuleSelection = {
  key: AutoRuleKey;
  sendDay: string;
  candidates: number;
  skipped: Partial<Record<AutoRuleSkipReason, number>>;
  excluded: Partial<Record<PostSaleExclusionReason, number>>;
  recipients: AutoRuleRecipient[];
};

export type PostSaleAutoSweepResult = {
  tenants: number;
  started: number;
  rules: Partial<Record<AutoRuleKey, { candidates: number; eligible: number; started: number; limitReached: boolean }>>;
  alreadyStarted: number;
  enqueueFailed: number;
  scheduled: boolean;
  recovered?: { retried: number; released: number };
  budgetExhausted?: boolean;
  skipped?: "slot" | "flag";
  lease?: "busy";
};

/** Contexto de leitura da empresa inteira, para o seletor (igual ao de um diretor, sem usuário real). */
function tenantWideContext(tenantId: string, userId: string): TenantContext {
  return { tenantId, userId, role: "director", jobTitle: "director", branchId: null, customRoleId: null };
}

/** Dentro do horário comercial envia agora; fora dele só agenda para a próxima abertura (seg a sex, 08h). */
export function autoRuleSchedule(now: Date) {
  const within = isBusinessHours(now);
  const sendAt = within ? undefined : nextBusinessOpening(now);
  return { within, sendAt, sendDay: saoPauloDateKey(sendAt ?? now) };
}

function bump<K extends string>(record: Partial<Record<K, number>>, key: K, by = 1) {
  record[key] = (record[key] ?? 0) + by;
}

/**
 * Seletor de uma regra (também usado na prévia): leads que bateram o marco + atraso no dia de
 * envio, filtros, piloto, regras próprias da regra e as proteções comuns do pós-venda (opt-out,
 * número inválido ou errado, conversa humana nas últimas 24 h, 30 dias entre conversas, sem
 * corretor, canal de origem e template aprovado). Não grava nada.
 */
export async function selectAutoRuleRecipients(input: {
  tenantId: string;
  settings: AutoRuleSettings;
  sendDay: string;
  now: Date;
  context: TenantContext;
  ignoreEnabled?: boolean;
}): Promise<AutoRuleSelection> {
  const db = getDatabase();
  const { tenantId, settings, sendDay, now } = input;
  const definition = AUTO_RULE_DEFINITIONS[settings.key];
  const floor = autoRuleMilestoneFloor(sendDay, settings.delayBusinessDays);
  const milestoneColumn = definition.milestone === "accepted" ? schema.leads.assignedAt : schema.leads.stageEnteredAt;
  const selection: AutoRuleSelection = { key: settings.key, sendDay, candidates: 0, skipped: {}, excluded: {}, recipients: [] };

  const rows = await db.select({
    id: schema.leads.id,
    status: schema.leads.status,
    tipo: schema.leads.tipo,
    queueId: schema.leads.queueId,
    branchId: sql<string | null>`coalesce(${schema.leads.branchId}, ${schema.leadQueues.branchId})`,
    brokerId: schema.leads.corretorId,
    distributionStatus: schema.leads.distributionStatus,
    assignmentSource: schema.leads.assignmentSource,
    motivoPerda: schema.leads.motivoPerda,
    lossCategory: schema.leads.lossCategory,
    milestoneAt: milestoneColumn,
    ownerRole: schema.tenantMemberships.role,
  })
    .from(schema.leads)
    .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.leads.queueId), eq(schema.leadQueues.tenantId, schema.leads.tenantId)))
    .leftJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.leads.corretorId), eq(schema.tenantMemberships.tenantId, schema.leads.tenantId)))
    .where(and(
      eq(schema.leads.tenantId, tenantId),
      isNull(schema.leads.deletedAt),
      isNull(schema.leads.archivedAt),
      definition.milestone === "accepted"
        ? and(inArray(schema.leads.status, [...AUTO_RULE_OPEN_STATUSES]), eq(schema.leads.distributionStatus, "assigned"), isNotNull(schema.leads.corretorId))
        : eq(schema.leads.status, definition.milestone),
      isNotNull(milestoneColumn),
      gte(milestoneColumn, floor),
      lte(milestoneColumn, now),
    ))
    .orderBy(asc(milestoneColumn), asc(schema.leads.id))
    .limit(CANDIDATE_LIMIT);
  selection.candidates = rows.length;
  if (!rows.length) return selection;
  const leadIds = rows.map((row) => row.id);

  // R4: o motivo dado pelo corretor também fica no histórico de etapas (texto livre).
  const lossReasons = new Map<string, string[]>();
  if (definition.milestone === "lost") {
    const history = await db.select({ leadId: schema.leadStageHistory.leadId, reason: schema.leadStageHistory.reason, lossCode: schema.leadStageHistory.lossCode })
      .from(schema.leadStageHistory)
      .where(and(eq(schema.leadStageHistory.tenantId, tenantId), inArray(schema.leadStageHistory.leadId, leadIds), eq(schema.leadStageHistory.toStatus, "lost")))
      .orderBy(desc(schema.leadStageHistory.changedAt));
    for (const row of history) {
      const list = lossReasons.get(row.leadId) ?? [];
      list.push(...[row.reason, row.lossCode].filter((value): value is string => Boolean(value)));
      lossReasons.set(row.leadId, list);
    }
  }
  // R2: não sai se a R1 deste lead foi respondida há pouco.
  const lastR1Answer = new Map<string, Date>();
  if (settings.key === "R2") {
    const answered = await db.select({ leadId: schema.postSaleSurveys.leadId, at: schema.postSaleSurveys.lastReplyAt })
      .from(schema.postSaleSurveys)
      .where(and(
        eq(schema.postSaleSurveys.tenantId, tenantId),
        inArray(schema.postSaleSurveys.leadId, leadIds),
        eq(schema.postSaleSurveys.ruleKey, "R1"),
        isNotNull(schema.postSaleSurveys.lastReplyAt),
        gte(schema.postSaleSurveys.lastReplyAt, new Date(now.getTime() - AUTO_RULE_LIMITS.r2SkipIfR1AnsweredDays * 86_400_000)),
      ));
    for (const row of answered) {
      if (row.at && (!lastR1Answer.has(row.leadId) || lastR1Answer.get(row.leadId)! < row.at)) lastR1Answer.set(row.leadId, row.at);
    }
  }

  const milestones = new Map<string, Date>();
  for (const row of rows) {
    if (!row.milestoneAt) continue;
    const decision = decideAutoRuleCandidate({
      settings,
      lead: {
        status: row.status,
        queueId: row.queueId,
        branchId: row.branchId,
        tipo: row.tipo,
        brokerId: row.brokerId,
        ownerRole: row.ownerRole,
        distributionStatus: row.distributionStatus,
        assignmentSource: row.assignmentSource,
        lossTexts: [row.motivoPerda, row.lossCategory, ...(lossReasons.get(row.id) ?? [])],
      },
      milestoneAt: row.milestoneAt,
      sendDay,
      lastR1AnswerAt: lastR1Answer.get(row.id) ?? null,
      now,
      ignoreEnabled: input.ignoreEnabled,
    });
    if (!decision.ok) {
      bump(selection.skipped, decision.skip);
      continue;
    }
    if (!milestones.has(row.id)) milestones.set(row.id, row.milestoneAt);
  }
  const eligibleIds = [...milestones.keys()];
  for (let index = 0; index < eligibleIds.length; index += AUDIENCE_CHUNK) {
    const chunk = eligibleIds.slice(index, index + AUDIENCE_CHUNK);
    const preview = await resolvePostSaleAudience(input.context, { kind: "leadIds", leadIds: chunk }, now, { cooldownDays: AUTO_RULE_LIMITS.cooldownDays });
    for (const [reason, count] of Object.entries(preview.excluded) as Array<[PostSaleExclusionReason, number]>) {
      if (count > 0) bump(selection.excluded, reason, count);
    }
    for (const recipient of preview.recipients) selection.recipients.push({ ...recipient, milestoneAt: milestones.get(recipient.leadId)! });
  }
  selection.recipients.sort((a, b) => a.milestoneAt.getTime() - b.milestoneAt.getTime());
  return selection;
}

/** Quantas conversas a régua já abriu no dia de envio, por regra (campanhas do dia). */
async function usageForDay(tenantId: string, sendDay: string) {
  const campaignIds = AUTO_RULE_KEYS.map((key) => autoRuleCampaignId(tenantId, key, sendDay));
  const rows = await getDatabase().select({ ruleKey: schema.postSaleSurveys.ruleKey, total: sql<number>`count(*)::int` })
    .from(schema.postSaleSurveys)
    .where(and(eq(schema.postSaleSurveys.tenantId, tenantId), inArray(schema.postSaleSurveys.campaignId, campaignIds), inArray(schema.postSaleSurveys.status, COUNTED_STATUSES)))
    .groupBy(schema.postSaleSurveys.ruleKey);
  const byRule = new Map<string, number>(rows.map((row) => [row.ruleKey ?? "", Number(row.total)]));
  return { byRule, total: [...byRule.values()].reduce((sum, value) => sum + value, 0) };
}

async function ensureAutoCampaign(tenantId: string, key: AutoRuleKey, sendDay: string, createdBy: string, now: Date) {
  const id = autoRuleCampaignId(tenantId, key, sendDay);
  const [year, month, day] = sendDay.split("-");
  await getDatabase().insert(schema.postSaleCampaigns).values({
    id,
    tenantId,
    name: `${key} ${AUTO_RULE_DEFINITIONS[key].label} ${day}/${month}/${year}`,
    audience: { kind: "rule", ruleKey: key, sendDay },
    kind: "auto",
    ruleKey: key,
    openingMessage: POST_SALE_WAHA_OPENING_DEFAULT,
    createdBy,
    status: "running",
    totals: {},
    createdAt: now,
    startedAt: now,
  }).onConflictDoNothing();
  return id;
}

type AutoSurveyState = { rule?: string; opening?: string; variables?: string[] };

/**
 * Recuperação (igual à R0): survey automático gravado como "queued" sem mensagem na fila quer dizer que
 * o processo parou entre a gravação e o envio. Depois de 2 min tenta de novo com a mesma chave do outbox
 * (nunca uma segunda mensagem); sem canal, sem texto ou com mais de 2 dias, marca como "failed" e libera o lead.
 */
async function recoverStuckAutoSurveys(now: Date) {
  const db = getDatabase();
  const stuck = await db.select({
    id: schema.postSaleSurveys.id,
    tenantId: schema.postSaleSurveys.tenantId,
    campaignId: schema.postSaleSurveys.campaignId,
    leadId: schema.postSaleSurveys.leadId,
    phone: schema.postSaleSurveys.phone,
    channelType: schema.postSaleSurveys.channelType,
    channelRef: schema.postSaleSurveys.channelRef,
    createdAt: schema.postSaleSurveys.createdAt,
    answers: schema.postSaleSurveys.answers,
  }).from(schema.postSaleSurveys).where(and(
    inArray(schema.postSaleSurveys.ruleKey, [...AUTO_RULE_KEYS]),
    eq(schema.postSaleSurveys.status, "queued"),
    isNull(schema.postSaleSurveys.outboundId),
    lt(schema.postSaleSurveys.createdAt, new Date(now.getTime() - 2 * 60_000)),
  )).limit(30);
  let retried = 0;
  let released = 0;
  const { sendAt } = autoRuleSchedule(now);
  for (const survey of stuck) {
    const release = async (reason: string) => {
      await db.update(schema.postSaleSurveys).set({ status: "failed", skipReason: reason })
        .where(and(eq(schema.postSaleSurveys.id, survey.id), eq(schema.postSaleSurveys.tenantId, survey.tenantId), eq(schema.postSaleSurveys.status, "queued"), isNull(schema.postSaleSurveys.outboundId)));
      released += 1;
    };
    const state = ((survey.answers as { auto?: AutoSurveyState } | null)?.auto ?? {}) as AutoSurveyState;
    if (now.getTime() - survey.createdAt.getTime() > 2 * 86_400_000) { await release("envio interrompido; régua antiga demais para reenviar"); continue; }
    if (!survey.channelType || !survey.channelRef) { await release("envio interrompido; canal indisponível"); continue; }
    try {
      const requestedBy = await resolveSystemUserId(survey.tenantId);
      const idempotencyKey = `post-sale:${survey.campaignId}:${survey.leadId}`;
      let outbound: { id: string; status: string };
      if (survey.channelType === "waha") {
        if (!state.opening) { await release("envio interrompido; texto de abertura indisponível"); continue; }
        outbound = await enqueuePostSaleSurveyWahaMessage({ tenantId: survey.tenantId, leadId: survey.leadId, wahaNumberId: survey.channelRef, destinationPhone: survey.phone, body: state.opening, requestedBy, idempotencyKey, scheduledAt: sendAt });
      } else {
        if (!Array.isArray(state.variables) || state.variables.length !== 3) { await release("envio interrompido; variáveis do template indisponíveis"); continue; }
        outbound = await enqueueMetaTemplateMessage({ tenantId: survey.tenantId, channelId: survey.channelRef, recipientType: "lead", recipientId: survey.leadId, destinationPhone: survey.phone, purpose: "postSaleSurvey", variables: state.variables, requestedBy, idempotencyKey, scheduledAt: sendAt, requireApprovedMetaTemplate: true, templateName: POST_SALE_META_TEMPLATE.name, strictSourceChannel: true });
      }
      const failed = ["failed", "cancelled", "expired", "skipped"].includes(outbound.status);
      await db.update(schema.postSaleSurveys).set({ outboundId: outbound.id, ...(failed ? { status: "failed", skipReason: "falha ao reenviar a abertura" } : {}) })
        .where(and(eq(schema.postSaleSurveys.id, survey.id), eq(schema.postSaleSurveys.tenantId, survey.tenantId)));
      retried += 1;
    } catch (error) {
      console.warn("[post-sale-auto] recovery_failed", { tenantId: survey.tenantId, surveyId: survey.id, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
      await release("envio interrompido; canal indisponível");
    }
  }
  return { retried, released };
}

/** O job roda a cada 5 min (cliente aguardando); a régua só a cada 15 min: minutos 0 a 4 de cada quarto de hora. */
export function isAutoRuleSlot(now: Date) {
  return now.getUTCMinutes() % 15 < 5;
}

/**
 * Motor da régua automática (Fase 4). Roda dentro do job /api/internal/jobs/customer-waiting, a cada
 * 15 min. Para cada empresa com regra ligada: seleciona, aplica limites (regra, piloto e empresa) e
 * enfileira a abertura pelo canal de origem. Fora do horário comercial só agenda para a abertura
 * seguinte. Idempotente: campanha por empresa, regra e dia; survey por lead, regra e marco; chave do
 * outbox `post-sale:<campanha>:<lead>`. Sem nota na linha do tempo do lead (o corretor não vê).
 */
export async function runPostSaleAutoSweep(now = new Date(), options: { force?: boolean; budgetMs?: number } = {}): Promise<PostSaleAutoSweepResult> {
  const empty: PostSaleAutoSweepResult = { tenants: 0, started: 0, rules: {}, alreadyStarted: 0, enqueueFailed: 0, scheduled: false };
  if (!options.force && !isAutoRuleSlot(now)) return { ...empty, skipped: "slot" };
  if (await getFeatureFlag(FEATURE_FLAGS.POST_SALE_AUDIT).catch(() => "false") !== "true") return { ...empty, skipped: "flag" };
  const deadline = Date.now() + (options.budgetMs ?? 40_000);
  const leased = await withJobLease("post-sale-auto", 100_000, async () => {
    const result: PostSaleAutoSweepResult = { ...empty, rules: {} };
    const recovered = await recoverStuckAutoSurveys(now).catch(() => null);
    if (recovered && (recovered.retried || recovered.released)) result.recovered = recovered;
    const tenantIds = await loadTenantsWithEnabledAutoRules();
    for (const tenantId of tenantIds) {
      if (Date.now() > deadline) { result.budgetExhausted = true; break; }
      result.tenants += 1;
      await runTenant(tenantId, now, deadline, result).catch((error) => console.error("[post-sale-auto] tenant_failed", { tenantId, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" }));
    }
    return result;
  });
  return leased.acquired ? leased.value : { ...empty, lease: "busy" };
}

async function runTenant(tenantId: string, now: Date, deadline: number, result: PostSaleAutoSweepResult) {
  const db = getDatabase();
  const [tenant] = await db.select({ name: schema.tenants.name, status: schema.tenants.status }).from(schema.tenants).where(eq(schema.tenants.id, tenantId)).limit(1);
  if (!tenant || tenant.status !== "active") return;
  const state = await loadAutoRules(tenantId);
  const enabled = state.rules.filter((rule) => rule.enabled);
  if (!state.ready || !enabled.length) return;
  const { sendAt, sendDay } = autoRuleSchedule(now);
  result.scheduled ||= Boolean(sendAt);
  const usage = await usageForDay(tenantId, sendDay);
  let usedByTenant = usage.total;
  if (usedByTenant >= AUTO_RULE_LIMITS.tenantDailyLimit) return;
  const systemUserId = await resolveSystemUserId(tenantId);
  const context = tenantWideContext(tenantId, systemUserId);
  const [config] = await db.select({ assistantName: schema.aiQualificationConfigs.assistantName }).from(schema.aiQualificationConfigs).where(eq(schema.aiQualificationConfigs.tenantId, tenantId)).limit(1);
  const companyName = tenant.name?.trim() || "nossa equipe";
  const assistantName = config?.assistantName?.trim() || "equipe de qualidade";

  for (const settings of enabled) {
    if (Date.now() > deadline) { result.budgetExhausted = true; return; }
    let usedByRule = usage.byRule.get(settings.key) ?? 0;
    const stats = { candidates: 0, eligible: 0, started: 0, limitReached: false };
    result.rules[settings.key] = stats;
    if (autoRuleRemainingCapacity({ settings, usedByRule, usedByTenant }) <= 0) { stats.limitReached = true; continue; }
    const selection = await selectAutoRuleRecipients({ tenantId, settings, sendDay, now, context });
    stats.candidates = selection.candidates;
    stats.eligible = selection.recipients.length;
    if (!selection.recipients.length) continue;
    const brokerIds = [...new Set(selection.recipients.map((recipient) => recipient.brokerId))];
    const brokers = await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, brokerIds));
    const brokerNames = new Map(brokers.map((broker) => [broker.id, firstName(broker.name)]));
    let campaignId: string | null = null;

    for (const recipient of selection.recipients) {
      if (Date.now() > deadline) { result.budgetExhausted = true; return; }
      if (autoRuleRemainingCapacity({ settings, usedByRule, usedByTenant }) <= 0) { stats.limitReached = true; break; }
      campaignId ??= await ensureAutoCampaign(tenantId, settings.key, sendDay, systemUserId, now);
      const surveyId = autoRuleSurveyId(tenantId, recipient.leadId, settings.key, recipient.milestoneAt);
      const brokerName = brokerNames.get(recipient.brokerId) ?? "nosso corretor";
      const opening = renderPostSaleOpeningMessage(POST_SALE_WAHA_OPENING_DEFAULT, { nome: firstName(recipient.name), assistente: assistantName, empresa: companyName, corretor: brokerName });
      const variables = [firstName(recipient.name), companyName, brokerName];
      const [inserted] = await db.insert(schema.postSaleSurveys).values({
        id: surveyId,
        tenantId,
        campaignId,
        leadId: recipient.leadId,
        brokerId: recipient.brokerId,
        phone: recipient.phone,
        status: "queued",
        step: 0,
        // Texto e variáveis guardados para a recuperação reenviar exatamente a mesma abertura.
        answers: { auto: { rule: settings.key, milestone: AUTO_RULE_DEFINITIONS[settings.key].milestone, milestoneAt: recipient.milestoneAt.toISOString(), sendDay, opening, variables } },
        channelType: recipient.channelType,
        channelRef: recipient.channelRef,
        ruleKey: settings.key,
        createdAt: now,
      }).onConflictDoNothing().returning({ id: schema.postSaleSurveys.id });
      if (!inserted) { result.alreadyStarted += 1; continue; }
      usedByRule += 1;
      usedByTenant += 1;

      const idempotencyKey = `post-sale:${campaignId}:${recipient.leadId}`;
      try {
        const outbound = recipient.channelType === "waha"
          ? await enqueuePostSaleSurveyWahaMessage({ tenantId, leadId: recipient.leadId, wahaNumberId: recipient.channelRef, destinationPhone: recipient.phone, body: opening, requestedBy: systemUserId, idempotencyKey, scheduledAt: sendAt })
          : await enqueueMetaTemplateMessage({ tenantId, channelId: recipient.channelRef, recipientType: "lead", recipientId: recipient.leadId, destinationPhone: recipient.phone, purpose: "postSaleSurvey", variables, requestedBy: systemUserId, idempotencyKey, scheduledAt: sendAt, requireApprovedMetaTemplate: true, templateName: POST_SALE_META_TEMPLATE.name, strictSourceChannel: true });
        const failed = ["failed", "cancelled", "expired"].includes(outbound.status);
        await db.update(schema.postSaleSurveys).set({
          outboundId: outbound.id,
          ...(failed ? { status: "failed", skipReason: "falha ao enfileirar o canal de origem" } : outbound.status === "skipped" ? { status: "skipped", skipReason: "número de origem indisponível" } : {}),
        }).where(and(eq(schema.postSaleSurveys.id, surveyId), eq(schema.postSaleSurveys.tenantId, tenantId)));
        if (failed || outbound.status === "skipped") {
          usedByRule -= 1;
          usedByTenant -= 1;
          result.enqueueFailed += 1;
          continue;
        }
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
        const reason = code === "FIRST_CONTACT_TEMPLATE_UNAVAILABLE" ? "template de pós-venda ainda não aprovado" : "número de origem indisponível";
        await db.update(schema.postSaleSurveys).set({ status: "skipped", skipReason: reason })
          .where(and(eq(schema.postSaleSurveys.id, surveyId), eq(schema.postSaleSurveys.tenantId, tenantId), isNull(schema.postSaleSurveys.outboundId)));
        console.warn("[post-sale-auto] enqueue_failed", { tenantId, leadId: recipient.leadId, rule: settings.key, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
        usedByRule -= 1;
        usedByTenant -= 1;
        result.enqueueFailed += 1;
        continue;
      }

      await db.update(schema.postSaleCampaigns).set({
        totals: sql`jsonb_set(coalesce(${schema.postSaleCampaigns.totals}, '{}'::jsonb), '{queued}', to_jsonb(coalesce((${schema.postSaleCampaigns.totals}->>'queued')::int, 0) + 1))`,
      }).where(and(eq(schema.postSaleCampaigns.id, campaignId), eq(schema.postSaleCampaigns.tenantId, tenantId)));
      // Sem nota na linha do tempo: o corretor lê a linha do tempo (mesma regra da R0). A auditoria guarda o rastro.
      await db.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: systemUserId,
        entidade: "lead",
        entidadeId: recipient.leadId,
        acao: "post_sale.auto.started",
        metadata: { surveyId, campaignId, ruleKey: settings.key, milestoneAt: recipient.milestoneAt.toISOString(), sendDay, channelType: recipient.channelType, scheduled: Boolean(sendAt) },
        createdAt: now,
      });
      stats.started += 1;
      result.started += 1;
    }
  }
}

export type AutoRulePreview = {
  key: AutoRuleKey;
  sendDay: string;
  candidates: number;
  eligible: number;
  wouldSend: number;
  limit: number;
  skipped: Array<{ reason: string; count: number }>;
  excluded: Array<{ reason: string; count: number }>;
};

/**
 * Prévia "amanhã sairiam N mensagens": roda o seletor para o próximo dia útil com as configurações
 * em edição (como se a regra estivesse ligada) e aplica o limite do dia. Não grava nada.
 */
export async function previewAutoRule(context: TenantContext, settings: AutoRuleSettings, now = new Date()): Promise<AutoRulePreview> {
  const sendDay = addBusinessDaysToDateKey(saoPauloDateKey(now), 1);
  const selection = await selectAutoRuleRecipients({ tenantId: context.tenantId, settings, sendDay, now, context, ignoreEnabled: true });
  const limit = Math.min(effectiveAutoRuleDailyLimit(settings), AUTO_RULE_LIMITS.tenantDailyLimit);
  const ignored: AutoRuleSkipReason[] = ["early", "stale", "disabled"];
  return {
    key: settings.key,
    sendDay,
    candidates: selection.candidates - ignored.reduce((sum, reason) => sum + (selection.skipped[reason] ?? 0), 0),
    eligible: selection.recipients.length,
    wouldSend: Math.min(selection.recipients.length, limit),
    limit,
    skipped: (Object.entries(selection.skipped) as Array<[AutoRuleSkipReason, number]>).filter(([reason, count]) => count > 0 && !ignored.includes(reason)).map(([reason, count]) => ({ reason: AUTO_RULE_SKIP_LABELS[reason], count })),
    excluded: (Object.entries(selection.excluded) as Array<[PostSaleExclusionReason, number]>).filter(([, count]) => count > 0).map(([reason, count]) => ({ reason: reason === "recent_survey" ? `pesquisado nos últimos ${AUTO_RULE_LIMITS.cooldownDays} dias` : POST_SALE_EXCLUSION_LABELS[reason], count })),
  };
}
