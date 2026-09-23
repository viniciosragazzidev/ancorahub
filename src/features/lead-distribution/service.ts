import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull, lte, ne, not, or, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { AuthorizationError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/types";
import { calculateBrokerRankingScore, defaultIntelligentDistributionPolicy, isAutomaticDistributionBranch, resolveDistributionCandidate, resolveDistributionPolicyScope, resolveDutyFallbackDecision, resolveLeadOfferCycle, resolveQueueCandidateBranchIds, reserveDistributionBranch, type IntelligentDistributionPolicy } from "./domain";
import type { AssignmentSource, DutyFallbackPolicy, LeadAssignmentResult, LeadRoutingResult } from "./types";
import { enqueueLeadEffectTx } from "@/features/leads/webhooks/services/lead-effect-outbox";
import { createLeadOffersForBrokers, loadBrokerPacingOffers } from "./offers";
import { earliestPacingRetryAt, evaluateBrokerOfferPacing, isOfferPacingEnabled, normalizeOfferPacing, type OfferPacingDecision } from "./offer-pacing";
import { resolveLeadDestinationRule } from "./routing-engine";
import { getHoldDisqualifiedLeads, shouldHoldDisqualifiedLead } from "./disqualified-routing-settings";
import { selectMatchingDutyScheduleIds } from "./duty-roster-matching";
import { normalizeQueueSource } from "./routing-catalog";
import { getActiveQueueDutyRoster } from "./active-queue-duty-roster";
import { getPresenceConfirmedAssignmentIds } from "./duty-presence";

const activeCommercialStatuses = ["distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;

function canManage(context: TenantContext) {
  return context.role === "director" || context.role === "manager";
}

function assertBranchScope(context: TenantContext, branchId: string) {
  if (context.role === "manager" && context.branchId !== branchId) throw new AuthorizationError("Você só pode operar leads da sua unidade.");
}

import { getLocalDutyParts } from "@/features/leads/assignment";

type RosterResolution = {
  brokerIds: Set<string> | null;
  hasActiveSelectedSchedule: boolean;
};

async function getRosterBrokerIds(
  tenantId: string,
  branchId: string,
  date = new Date(),
  webhookCredentialId?: string | null,
  exclusiveScheduleIds?: string[] | null,
  dutyFallbackPolicy: DutyFallbackPolicy = "unit_roster",
): Promise<RosterResolution> {
  const db = getDatabase();
  const local = getLocalDutyParts(date);

  // 1. Find plantões active right now for this branch
  const activeSchedules = await db.select({
    id: schema.unitDutySchedules.id,
    webhookCredentialId: schema.unitDutySchedules.webhookCredentialId,
    dayOfWeek: schema.unitDutySchedules.dayOfWeek,
    startsAt: schema.unitDutySchedules.startsAt,
    endsAt: schema.unitDutySchedules.endsAt,
    timezone: schema.unitDutySchedules.timezone,
    validFrom: schema.unitDutySchedules.validFrom,
    validUntil: schema.unitDutySchedules.validUntil,
  })
    .from(schema.unitDutySchedules)
    .where(and(
      eq(schema.unitDutySchedules.tenantId, tenantId),
      or(eq(schema.unitDutySchedules.branchId, branchId), isNull(schema.unitDutySchedules.branchId)),
      eq(schema.unitDutySchedules.dayOfWeek, local.weekday),
      eq(schema.unitDutySchedules.status, "active"),
      lte(schema.unitDutySchedules.startsAt, local.time),
      gt(schema.unitDutySchedules.endsAt, local.time),
      lte(schema.unitDutySchedules.validFrom, date),
      or(isNull(schema.unitDutySchedules.validUntil), gt(schema.unitDutySchedules.validUntil, date)),
    ));

  const scopedSchedules = exclusiveScheduleIds?.length
    ? activeSchedules.filter((schedule) => exclusiveScheduleIds.includes(schedule.id))
    : activeSchedules;

  // No plantões at all → fallback to all brokers (legacy behavior). A queue
  // with explicit exclusivity is different: no active selected schedule means
  // no eligible broker, so the lead remains queued for a later retry.
  const fallbackDecision = resolveDutyFallbackDecision({
    policy: dutyFallbackPolicy,
    hasExplicitSchedule: Boolean(exclusiveScheduleIds?.length),
    hasActiveSelectedSchedule: scopedSchedules.length > 0,
  });
  if (fallbackDecision === "use_unit_roster") return { brokerIds: null, hasActiveSelectedSchedule: false };
  if (!scopedSchedules.length) return { brokerIds: new Set<string>(), hasActiveSelectedSchedule: false };

  // 2. Filter plantões by credential if the lead has a source
  const matchingScheduleIds = selectMatchingDutyScheduleIds(scopedSchedules, webhookCredentialId);

  // Plantões exist for this branch but none match the credential → no brokers eligible
  if (!matchingScheduleIds.length) return { brokerIds: new Set<string>(), hasActiveSelectedSchedule: true };

  // 3. Get brokers assigned to matching plantões right now
  const assignments = await db.select({
    id: schema.dutyRosterAssignments.id,
    brokerId: schema.dutyRosterAssignments.brokerId,
    scheduleId: schema.dutyRosterAssignments.scheduleId,
    dayOfWeek: schema.dutyRosterAssignments.dayOfWeek,
    startsAt: schema.dutyRosterAssignments.startsAt,
    endsAt: schema.dutyRosterAssignments.endsAt,
    validFrom: schema.dutyRosterAssignments.validFrom,
    validUntil: schema.dutyRosterAssignments.validUntil,
  })
    .from(schema.dutyRosterAssignments)
    .where(and(
      eq(schema.dutyRosterAssignments.tenantId, tenantId),
      eq(schema.dutyRosterAssignments.branchId, branchId),
      eq(schema.dutyRosterAssignments.dayOfWeek, local.weekday),
      eq(schema.dutyRosterAssignments.status, "active"),
      lte(schema.dutyRosterAssignments.startsAt, local.time),
      gt(schema.dutyRosterAssignments.endsAt, local.time),
      lte(schema.dutyRosterAssignments.validFrom, date),
      or(isNull(schema.dutyRosterAssignments.validUntil), gt(schema.dutyRosterAssignments.validUntil, date)),
      inArray(schema.dutyRosterAssignments.scheduleId, matchingScheduleIds),
    ));

  // A matching plantão without escalated brokers has no eligible broker. It must
  // remain queued instead of silently falling back to the whole unit roster.
  const confirmedAssignmentIds = await getPresenceConfirmedAssignmentIds({
    tenantId,
    assignments,
    schedules: activeSchedules.filter((schedule) => matchingScheduleIds.includes(schedule.id)),
    now: date,
  });
  return { brokerIds: new Set(assignments.filter((assignment) => confirmedAssignmentIds.has(assignment.id)).map((assignment) => assignment.brokerId)), hasActiveSelectedSchedule: true };
}

async function ensureDefaultQueue(tenantId: string, branchId: string, actorId: string) {
  const db = getDatabase();
  await db.insert(schema.leadQueues).values({ id: randomUUID(), tenantId, branchId, name: "Fila geral", slug: "geral", isDefault: true, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
  const [queue] = await db.select({ id: schema.leadQueues.id }).from(schema.leadQueues).where(and(eq(schema.leadQueues.tenantId, tenantId), eq(schema.leadQueues.branchId, branchId), eq(schema.leadQueues.isDefault, true), eq(schema.leadQueues.status, "active"))).orderBy(asc(schema.leadQueues.createdAt)).limit(1);
  if (!queue) throw new Error("A unidade não possui uma fila ativa. Crie uma fila para a unidade antes de enviar leads.");
  void actorId;
  return queue.id;
}

function readDistributionPolicy(value: unknown): IntelligentDistributionPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultIntelligentDistributionPolicy;
  const raw = value as Partial<IntelligentDistributionPolicy>;
  return {
    excludedBrokerIds: Array.isArray(raw.excludedBrokerIds) ? raw.excludedBrokerIds.filter((id): id is string => typeof id === "string") : [],
    excludedBranchIds: Array.isArray(raw.excludedBranchIds) ? raw.excludedBranchIds.filter((id): id is string => typeof id === "string") : [],
    allowedBrokerIds: Array.isArray(raw.allowedBrokerIds) ? raw.allowedBrokerIds.filter((id): id is string => typeof id === "string") : [],
    allowedBranchIds: Array.isArray(raw.allowedBranchIds) ? raw.allowedBranchIds.filter((id): id is string => typeof id === "string") : [],
    allowedSourceIds: Array.isArray(raw.allowedSourceIds) ? raw.allowedSourceIds.filter((id): id is string => typeof id === "string") : [],
    ranking: { ...defaultIntelligentDistributionPolicy.ranking, ...(raw.ranking ?? {}) },
  };
}

async function loadDistributionPolicy(tenantId: string, queueId: string | null, profileKey: string | null) {
  const scope = resolveDistributionPolicyScope(queueId, profileKey);
  const [row] = await getDatabase().select({ enabled: schema.leadDistributionPolicies.enabled, policy: schema.leadDistributionPolicies.policy })
    .from(schema.leadDistributionPolicies)
    .where(and(
      eq(schema.leadDistributionPolicies.tenantId, tenantId),
      scope.queueId
        ? eq(schema.leadDistributionPolicies.queueId, scope.queueId)
        : isNull(schema.leadDistributionPolicies.queueId),
      scope.profileKey
        ? eq(schema.leadDistributionPolicies.profileKey, scope.profileKey)
        : isNull(schema.leadDistributionPolicies.profileKey),
    ))
    .orderBy(asc(schema.leadDistributionPolicies.createdAt)).limit(1);
  return { enabled: row?.enabled ?? true, value: readDistributionPolicy(row?.policy) };
}

export async function validateCampaignQueueRoute(
  db: ReturnType<typeof getDatabase>,
  tenantId: string,
  leadId: string,
  targetQueueId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const [lead] = await db
    .select({
      id: schema.leads.id,
      metaCampaignId: schema.leads.metaCampaignId,
      sourceCampaign: schema.leads.sourceCampaign,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId)))
    .limit(1);

  if (!lead) return { allowed: true };

  const campaignId = lead.metaCampaignId || lead.sourceCampaign;
  if (!campaignId) return { allowed: true };

  const [route] = await db
    .select({
      queueId: schema.metaCampaignQueueRoutes.queueId,
      enabled: schema.metaCampaignQueueRoutes.enabled,
    })
    .from(schema.metaCampaignQueueRoutes)
    .where(
      and(
        eq(schema.metaCampaignQueueRoutes.tenantId, tenantId),
        eq(schema.metaCampaignQueueRoutes.campaignId, campaignId),
      ),
    )
    .limit(1);

  if (route && route.enabled && route.queueId && route.queueId !== targetQueueId) {
    const [targetQueue] = await db
      .select({ name: schema.leadQueues.name })
      .from(schema.leadQueues)
      .where(and(eq(schema.leadQueues.id, targetQueueId), eq(schema.leadQueues.tenantId, tenantId)))
      .limit(1);

    return {
      allowed: false,
      reason: `Bloqueio de Regra: A campanha "${campaignId}" está vinculada exclusivamente a outra fila. Vincule a campanha à fila "${targetQueue?.name ?? "de destino"}" antes de transferir.`,
    };
  }

  return { allowed: true };
}

export async function routeLeadToBranch(context: TenantContext, leadId: string, branchId: string, reason = "Distribuição manual para unidade", overrideCampaign = false): Promise<LeadRoutingResult> {
  if (!canManage(context)) throw new AuthorizationError("Apenas Gestores e Diretores podem distribuir leads.");
  assertBranchScope(context, branchId);
  const db = getDatabase();
  const [branch] = await db.select({ id: schema.branches.id, acceptingLeads: schema.branches.acceptingLeads, status: schema.branches.status, isDistributionHub: schema.branches.isDistributionHub }).from(schema.branches).where(and(eq(schema.branches.id, branchId), eq(schema.branches.tenantId, context.tenantId))).limit(1);
  if (!branch || branch.status !== "active" || (!branch.isDistributionHub && !branch.acceptingLeads)) return { status: "failed", code: "BRANCH_NOT_ACCEPTING_LEADS" };
  if (branch.isDistributionHub && context.role !== "director") throw new AuthorizationError("Somente Diretores podem encaminhar leads para a Central de redistribuição.");
  // Atribuição manual não requer fila — usa null quando não há fila na unidade
  let queueId: string | null = null;
  try {
    queueId = await ensureDefaultQueue(context.tenantId, branchId, context.userId);
  } catch {
    // Unidade sem fila: roteamento continua sem fila vinculada
  }
  const [lead] = await db.select({ id: schema.leads.id, branchId: schema.leads.branchId, corretorId: schema.leads.corretorId, status: schema.leads.status, firstContactAt: schema.leads.firstContactAt, serviceStartedAt: schema.leads.serviceStartedAt, metaCampaignId: schema.leads.metaCampaignId, sourceCampaign: schema.leads.sourceCampaign, archivedAt: schema.leads.archivedAt }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt))).limit(1);
  if (!lead) return { status: "failed", code: "LEAD_NOT_FOUND" };
  const canMovePendingAssignment = !lead.corretorId || ((lead.status === "new" || lead.status === "distributed") && !lead.firstContactAt && !lead.serviceStartedAt);
  if (!canMovePendingAssignment) return { status: "conflict", code: "LEAD_ALREADY_IN_SERVICE" };

  if (queueId && !overrideCampaign) {
    const campaignCheck = await validateCampaignQueueRoute(db, context.tenantId, leadId, queueId);
    if (!campaignCheck.allowed) {
      const campaignId = lead.metaCampaignId || lead.sourceCampaign;
      const [targetQueue] = queueId ? await db.select({ name: schema.leadQueues.name }).from(schema.leadQueues).where(and(eq(schema.leadQueues.id, queueId), eq(schema.leadQueues.tenantId, context.tenantId))).limit(1) : [];
      return { status: "campaign_conflict", campaignId: campaignId ?? "unknown", queueName: targetQueue?.name ?? null, targetBranchId: branchId };
    }
  }

  const updated = await db.transaction(async (tx) => {
    const updateData: Record<string, unknown> = {
      branchId,
      corretorId: null,
      distributionStatus: queueId ? "queued" : "unassigned",
      distributionOrigin: context.role === "director" ? "parent" : "unit",
      unitAssignedAt: new Date(),
      assignmentSource: context.role === "director" ? "manual_director" : "manual_manager",
      assignmentStrategy: "manual",
      distributionUpdatedAt: new Date(),
    };
    // Só vincula fila quando existe; sem fila, o lead fica aguardando fila/unidade
    if (queueId) updateData.queueId = queueId;
    const result = await tx.update(schema.leads).set(updateData).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt), or(isNull(schema.leads.corretorId), and(inArray(schema.leads.status, ["new", "distributed"]), isNull(schema.leads.firstContactAt), isNull(schema.leads.serviceStartedAt))))).returning({ id: schema.leads.id });
    if (!result.length) return false;
    await tx.insert(schema.leadDistributionEvents).values({ id: randomUUID(), tenantId: context.tenantId, leadId, fromBranchId: lead.branchId, toBranchId: branchId, previousOwnerId: lead.corretorId, toQueueId: queueId, action: "routed_to_unit", source: context.role === "director" ? "manual_director" : "manual_manager", strategy: "manual", reason, actorId: context.userId, createdAt: new Date() });
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_distribution", entidadeId: leadId, acao: "lead.routed_to_unit" });
    return true;
  });
  return updated ? { status: "routed", branchId, queueId, strategy: "manual" } : { status: "conflict", code: "LEAD_ALREADY_ASSIGNED" };
}

export async function routeLeadToBranchAndAssignBroker(
  context: TenantContext,
  leadId: string,
  branchId: string,
  brokerId: string,
  reason = "Roteamento e atribuição pelo diretor",
): Promise<LeadAssignmentResult> {
  if (context.role !== "director") throw new AuthorizationError("Apenas Diretores podem rotear e atribuir em uma única operação.");
  const db = getDatabase();

  // 1. Verify branch
  const [branch] = await db
    .select({ id: schema.branches.id, acceptingLeads: schema.branches.acceptingLeads, status: schema.branches.status, isDistributionHub: schema.branches.isDistributionHub })
    .from(schema.branches)

    .where(and(eq(schema.branches.id, branchId), eq(schema.branches.tenantId, context.tenantId)))
    .limit(1);
  if (!branch || branch.status !== "active" || !branch.acceptingLeads || branch.isDistributionHub)
    return { status: "conflict", leadId, reason: "A unidade não pode receber leads agora." };

  // 2. Get lead
  const [lead] = await db
    .select({ id: schema.leads.id, nome: schema.leads.nome, branchId: schema.leads.branchId, corretorId: schema.leads.corretorId, archivedAt: schema.leads.archivedAt })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.archivedAt)))
    .limit(1);
  if (!lead) return { status: "conflict", leadId, reason: "Lead não encontrado." };
  if (lead.corretorId) return { status: "conflict", leadId, reason: "Este lead já possui um corretor." };

  // 3. Verify broker belongs to the target branch
  const [broker] = await db
    .select({ id: schema.user.id })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        eq(schema.tenantMemberships.userId, brokerId),
        eq(schema.tenantMemberships.branchId, branchId),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.jobTitle, "broker"),
        eq(schema.tenantMemberships.status, "active"),
        eq(schema.tenantMemberships.availabilityStatus, "available"),
        eq(schema.user.active, true),
        eq(schema.user.status, "active"),
      ),
    )
    .limit(1);

  if (!broker) return { status: "conflict", leadId, reason: "Corretor indisponível ou não pertence a esta unidade." };

  const [targetQueue] = await db
    .select({ id: schema.leadQueues.id })
    .from(schema.leadQueues)
    .where(and(eq(schema.leadQueues.tenantId, context.tenantId), eq(schema.leadQueues.branchId, branchId), eq(schema.leadQueues.status, "active")))
    .limit(1);

  const queueId = targetQueue?.id ?? null;
  const assignmentEventId = randomUUID();

  const assigned = await db.transaction(async (tx) => {
    const result = await tx
      .update(schema.leads)
      .set({
        branchId,
        queueId,
        corretorId: brokerId,
        status: "distributed",
        distributionStatus: "assigned",
        distributionOrigin: "parent",
        unitAssignedAt: new Date(),
        assignedAt: new Date(),
        assignmentSource: "manual_director",
        assignmentStrategy: "manual",
        distributionUpdatedAt: new Date(),
      })
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.corretorId), isNull(schema.leads.archivedAt)))
      .returning({ id: schema.leads.id });

    if (!result.length) return false;

    await tx.insert(schema.leadDistributionEvents).values({
      id: assignmentEventId,
      tenantId: context.tenantId,
      leadId,
      fromBranchId: lead.branchId,
      toBranchId: branchId,
      toQueueId: queueId,
      previousOwnerId: lead.corretorId,
      newOwnerId: brokerId,
      action: "routed_and_assigned",
      source: "manual_director",
      strategy: "manual",
      reason,
      actorId: context.userId,
      createdAt: new Date(),
    });
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "lead_distribution",
      entidadeId: leadId,
      acao: "lead.routed_and_assigned",
    });
    await enqueueLeadEffectTx(tx, {
      tenantId: context.tenantId,
      leadId,
      type: "NOTIFY_LEAD_ASSIGNED",
      idempotencyKey: `lead-assigned:${assignmentEventId}`,
      payload: { branchId, brokerId, leadName: lead.nome, isRedistribution: "false" },
    });

    return true;
  });

  return assigned
    ? { status: "assigned", leadId, brokerId, strategy: "manual" }
    : { status: "conflict", leadId, reason: "Este lead já foi atribuído. Atualize a fila." };
}

export async function assignLeadToBroker(context: TenantContext, leadId: string, brokerId: string, source?: AssignmentSource, reason = "Atribuição manual", excludeBrokerId?: string | null, targetBranchId?: string, options?: { skipBrokerWhatsApp?: boolean; requireUnassigned?: boolean }): Promise<LeadAssignmentResult> {
  if (!canManage(context)) throw new AuthorizationError("Apenas Gestores e Diretores podem atribuir leads.");
  const db = getDatabase();
  const [lead] = await db.select({ id: schema.leads.id, nome: schema.leads.nome, branchId: schema.leads.branchId, queueId: schema.leads.queueId, corretorId: schema.leads.corretorId, distributionOrigin: schema.leads.distributionOrigin, archivedAt: schema.leads.archivedAt }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.archivedAt))).limit(1);
  if (!lead) return { status: "conflict", leadId, reason: "Lead não encontrado." };
  if (options?.requireUnassigned && lead.corretorId) return { status: "conflict", leadId, reason: "Esta escolha só pode ser usada em leads sem corretor." };
  if (lead.corretorId === brokerId) return { status: "conflict", leadId, reason: "O lead já está atribuído a este corretor." };
  if (!lead.branchId && !targetBranchId) return { status: "conflict", leadId, reason: "Envie o lead para uma unidade antes de atribuir um corretor." };

  if (lead.queueId) {
    const campaignCheck = await validateCampaignQueueRoute(db, context.tenantId, leadId, lead.queueId);
    if (!campaignCheck.allowed) {
      return { status: "conflict", leadId, reason: campaignCheck.reason ?? "Campanha não permitida para esta fila." };
    }
  }

  const assignmentBranchId = targetBranchId ?? lead.branchId!;
  assertBranchScope(context, assignmentBranchId);
  const [broker] = await db.select({ id: schema.user.id, branchId: schema.tenantMemberships.branchId }).from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id)).where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, brokerId), eq(schema.tenantMemberships.branchId, assignmentBranchId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.jobTitle, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.tenantMemberships.availabilityStatus, "available"), eq(schema.user.active, true), eq(schema.user.status, "active"))).limit(1);
  if (!broker) return { status: "conflict", leadId, reason: "O corretor não está elegível nesta unidade." };
  if (excludeBrokerId && brokerId === excludeBrokerId) return { status: "conflict", leadId, reason: "O corretor que perdeu o SLA não pode receber este lead novamente." };
  const [tenantPolicy] = await db.select({ feedbackRequiredEnabled: schema.tenants.feedbackRequiredEnabled, feedbackGraceMinutes: schema.tenants.feedbackGraceMinutes, slaFirstContactMinutes: schema.tenants.slaFirstContactMinutes }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1);
  const assignedAt = new Date();
  const assignmentEventId = randomUUID();
  const feedbackDueAt = new Date(assignedAt.getTime() + ((Number.parseInt(tenantPolicy?.slaFirstContactMinutes ?? "15", 10) || 15) + (Number.parseInt(tenantPolicy?.feedbackGraceMinutes ?? "5", 10) || 5)) * 60_000);
  const assigned = await db.transaction(async (tx) => {
    const result = await tx.update(schema.leads).set({ branchId: assignmentBranchId, corretorId: brokerId, status: "distributed", distributionStatus: "assigned", distributionOrigin: source === "manual_director" ? "parent" : source === "manual_manager" ? "unit" : lead.distributionOrigin ?? (context.role === "director" ? "parent" : "unit"), assignedAt, assignmentSource: source ?? (context.role === "director" ? "manual_director" : "manual_manager"), assignmentStrategy: "manual", distributionUpdatedAt: assignedAt, firstContactAt: null, serviceStartedAt: null, serviceStartedBy: null, stageEnteredAt: assignedAt, motivoPerda: null }).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.archivedAt), lead.corretorId ? eq(schema.leads.corretorId, lead.corretorId) : isNull(schema.leads.corretorId))).returning({ id: schema.leads.id });
    if (!result.length) return false;
    if (tenantPolicy?.feedbackRequiredEnabled !== false) {
      const [attemptCount] = await tx.select({ total: count(schema.leadAssignmentAttempts.id) }).from(schema.leadAssignmentAttempts).where(and(eq(schema.leadAssignmentAttempts.tenantId, context.tenantId), eq(schema.leadAssignmentAttempts.leadId, leadId)));
      await tx.insert(schema.leadAssignmentAttempts).values({ id: randomUUID(), tenantId: context.tenantId, leadId, brokerId, sequence: Number(attemptCount?.total ?? 0) + 1, assignedAt, feedbackDueAt, status: "open", createdAt: assignedAt });
    }
    await tx.insert(schema.leadDistributionEvents).values({ id: assignmentEventId, tenantId: context.tenantId, leadId, fromBranchId: lead.branchId, toBranchId: assignmentBranchId, fromQueueId: lead.queueId, toQueueId: lead.queueId, previousOwnerId: lead.corretorId, newOwnerId: brokerId, action: "assigned", source: source ?? "manual_manager", strategy: "manual", reason, actorId: context.userId, createdAt: assignedAt });
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_distribution", entidadeId: leadId, acao: "lead.assigned" });
    await enqueueLeadEffectTx(tx, {
      tenantId: context.tenantId,
      leadId,
      type: "NOTIFY_LEAD_ASSIGNED",
      idempotencyKey: `lead-assigned:${assignmentEventId}`,
      payload: {
        branchId: assignmentBranchId,
        brokerId,
        leadName: lead.nome,
        isRedistribution: lead.corretorId ? "true" : "false",
        ...(options?.skipBrokerWhatsApp ? { skipBrokerWhatsapp: "true" } : {}),
      },
    });
    return true;
  });
  return assigned
    ? { status: "assigned", leadId, brokerId, strategy: "manual" }
    : { status: "conflict", leadId, reason: "Este lead já foi atribuído. Atualize a fila." };
}

export async function processQueuedLead(context: TenantContext, leadId: string, excludeBrokerId?: string | null, fallbackDepth = 0): Promise<LeadAssignmentResult> {
  if (!canManage(context)) throw new AuthorizationError("Você não pode executar a distribuição automática.");
  if (fallbackDepth > 3) return { status: "queued", leadId, reason: "O encadeamento de filas de contingência excedeu o limite seguro." };
  const db = getDatabase();
  const [lead] = await db.select({
    id: schema.leads.id,
    nome: schema.leads.nome,
    branchId: schema.leads.branchId,
    queueId: schema.leads.queueId,
    webhookCredentialId: schema.leads.webhookCredentialId,
    qualificationProfileKey: schema.leads.qualificationProfileKey,
    qualificationState: schema.leads.qualificationState,
    qualificationStatus: schema.leads.qualificationStatus,
    tipo: schema.leads.tipo,
    origem: schema.leads.origem,
    sourceChannel: schema.leads.sourceChannel,
    formData: schema.leads.formData,
    distributionUpdatedAt: schema.leads.distributionUpdatedAt,
    distributionStatus: schema.leads.distributionStatus,
    corretorId: schema.leads.corretorId,
    assignmentSource: schema.leads.assignmentSource,
    status: schema.leads.status,
    deletedAt: schema.leads.deletedAt,
    archivedAt: schema.leads.archivedAt,
  }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  if (!lead) return { status: "queued", leadId, reason: "Lead não encontrado." };
  if (lead.distributionStatus === "manual_hold") {
    return { status: "manual_required", leadId, reason: "A atribuição foi removida manualmente; o lead aguarda uma nova ação manual." };
  }
  if (lead.deletedAt || lead.archivedAt || !["new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(lead.status)) {
    return { status: "manual_required", leadId, reason: "Lead inativo; distribuição bloqueada." };
  }
  if (lead.assignmentSource === "manual_offer" && lead.corretorId) {
    const [manualOffer] = await db.select({ brokerId: schema.leadOffers.brokerId, expiresAt: schema.leadOffers.expiresAt })
      .from(schema.leadOffers).where(and(
        eq(schema.leadOffers.tenantId, context.tenantId),
        eq(schema.leadOffers.leadId, leadId),
        eq(schema.leadOffers.brokerId, lead.corretorId),
        inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
        gt(schema.leadOffers.expiresAt, new Date()),
      )).limit(1);
    if (manualOffer) return {
      status: "offered",
      leadId,
      brokerId: manualOffer.brokerId,
      expiresAt: manualOffer.expiresAt,
      reason: "Oferta manual aguardando resposta do corretor.",
    };
  }
  // Synthetic records created from internal/team WhatsApp messages are not
  // customer leads and must never enter the broker offer cycle.
  if (/^Lead WhatsApp\s*\(/i.test(lead.nome?.trim() ?? "")) {
    return { status: "manual_required", leadId, reason: "Mensagem interna sem lead válido; distribuição ignorada." };
  }
  if (lead.qualificationStatus === "disqualified" && await getHoldDisqualifiedLeads(context.tenantId)) {
    const formData = lead.formData && typeof lead.formData === "object" && !Array.isArray(lead.formData)
      ? lead.formData as Record<string, unknown>
      : {};
    const readFormValue = (keys: string[]) => keys
      .map((key) => formData[key])
      .find((value) => value !== null && value !== undefined && String(value).trim() !== "");
    const rawLives = readFormValue(["vidas", "n_vidas", "dependentes", "lives"]);
    const parsedLives = rawLives === undefined ? undefined : Number(rawLives);
    const { matchedRule } = await resolveLeadDestinationRule(context.tenantId, {
      planType: String(readFormValue(["tipo", "tipoPlano", "tipo_plano", "plano", "planType"]) ?? lead.tipo),
      source: String(readFormValue(["origem", "source", "canal", "sourceChannel"]) ?? lead.sourceChannel ?? lead.origem),
      city: String(readFormValue(["cidade", "city", "localidade"]) ?? ""),
      lives: Number.isFinite(parsedLives) ? parsedLives : undefined,
      qualificationStatus: lead.qualificationStatus,
      branchId: lead.branchId,
    });
    if (shouldHoldDisqualifiedLead({
      holdDisqualifiedLeads: true,
      matchedRuleMode: matchedRule?.distributionMode,
    })) {
      return { status: "queued", leadId, reason: "Lead desqualificado mantido em espera pela regra global de segurança." };
    }
  }
  const canRotateCurrentOwner = Boolean(
    lead.corretorId
      && (lead.assignmentSource === "automatic_offer" || lead.assignmentSource === "manual_offer" || lead.corretorId === excludeBrokerId),
  );
  if (lead.corretorId && !canRotateCurrentOwner) {
    return { status: "conflict", leadId, reason: "Lead já possui corretor confirmado." };
  }
  const brokerToExclude = excludeBrokerId ?? (lead.assignmentSource === "automatic_offer" || lead.assignmentSource === "manual_offer" ? lead.corretorId : null);
  if (lead.qualificationState === "IN_PROGRESS" || lead.qualificationStatus === "qualifying") {
    return { status: "queued", leadId, reason: "O lead está em processo de qualificação por IA e aguarda a finalização ou tempo limite para ser distribuído." };
  }
  const [queue] = lead.queueId ? await db.select({ branchId: schema.leadQueues.branchId, strategy: schema.leadQueues.assignmentStrategy, mode: schema.leadQueues.assignmentMode, capacityEnabled: schema.leadQueues.capacityEnabled, capacity: schema.leadQueues.capacityPerBroker, offerIntervalMinutes: schema.leadQueues.offerIntervalMinutes, maxPendingOffers: schema.leadQueues.maxPendingOffersPerBroker, exclusiveDutyScheduleId: schema.leadQueues.exclusiveDutyScheduleId, exclusiveDutyScheduleIds: schema.leadQueues.exclusiveDutyScheduleIds, dutyFallbackPolicy: schema.leadQueues.dutyFallbackPolicy, dutyFallbackQueueId: schema.leadQueues.dutyFallbackQueueId }).from(schema.leadQueues).where(and(eq(schema.leadQueues.id, lead.queueId), eq(schema.leadQueues.tenantId, context.tenantId), eq(schema.leadQueues.status, "active"))).limit(1) : [];
  if (lead.queueId && !queue) {
    const staleQueueId = lead.queueId;
    const repairedAt = new Date();
    await db.transaction(async (tx) => {
      await tx.update(schema.leads).set({ queueId: null, distributionUpdatedAt: repairedAt, updatedAt: repairedAt })
        .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.queueId, staleQueueId)));
      await tx.insert(schema.leadDistributionEvents).values({ id: randomUUID(), tenantId: context.tenantId, leadId, fromBranchId: lead.branchId, toBranchId: lead.branchId, fromQueueId: staleQueueId, toQueueId: null, action: "inactive_queue_repaired", source: "system_recovery", strategy: "automatic", reason: "Fila inativa removida para permitir recuperação automática.", actorId: context.userId, createdAt: repairedAt });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_distribution", entidadeId: leadId, acao: "lead.inactive_queue_repaired" });
    });
    lead.queueId = null;
  }
  if (queue?.mode === "manual") return { status: "queued", leadId, reason: "A fila está em modo manual." };
  if (queue?.branchId) {
    if (lead.branchId && queue.branchId !== lead.branchId) return { status: "queued", leadId, reason: "A fila configurada pertence a outra unidade." };
    assertBranchScope(context, queue.branchId);
  }
  const intelligentPolicy = await loadDistributionPolicy(context.tenantId, lead.queueId, lead.qualificationProfileKey);
  if (!intelligentPolicy.enabled) {
    return { status: "queued", leadId, reason: "A política de distribuição está pausada para esta fila." };
  }
  const allowedSourceIds = intelligentPolicy.value.allowedSourceIds ?? [];
  if (allowedSourceIds.length) {
    const source = normalizeQueueSource(lead.sourceChannel, lead.origem, Boolean(lead.webhookCredentialId));
    if (!allowedSourceIds.includes(source)) {
      return { status: "queued", leadId, reason: `A origem ${source} não está habilitada nesta fila.` };
    }
  }
  if (queue?.branchId && intelligentPolicy.value.excludedBranchIds.includes(queue.branchId)) {
    return { status: "queued", leadId, reason: "A política de distribuição está pausada para esta unidade." };
  }
  const policyBranchIds = (intelligentPolicy.value.allowedBranchIds ?? [])
    .filter((branchId) => !intelligentPolicy.value.excludedBranchIds.includes(branchId));
  // An unbound queue with no allow-list means “todas as unidades”. Do not
  // collapse that scope to the lead's current unit; the tenant-wide selector
  // below will choose the least-loaded eligible unit in rotation.
  const configuredBranchIds = resolveQueueCandidateBranchIds({
    queueBranchId: queue?.branchId ?? null,
    allowedBranchIds: policyBranchIds,
    leadBranchId: queue?.branchId || policyBranchIds.length ? lead.branchId : null,
  });
  let requestedBranchIds = context.role === "manager" && context.branchId
    ? configuredBranchIds.filter((branchId) => branchId === context.branchId)
    : configuredBranchIds;
  if (!requestedBranchIds.length) {
    if (context.role === "manager" && context.branchId) {
      requestedBranchIds.push(context.branchId);
    }
  }
  let balanceAcrossBranches = requestedBranchIds.length === 0 || requestedBranchIds.length > 1;
  if (!requestedBranchIds.length) {
    const tenantWideBranches = await db.select({ id: schema.branches.id })
      .from(schema.branches)
      .where(and(
        eq(schema.branches.tenantId, context.tenantId),
        eq(schema.branches.status, "active"),
        eq(schema.branches.acceptingLeads, true),
        eq(schema.branches.autoDistribute, true),
        eq(schema.branches.isDistributionHub, false),
        intelligentPolicy.value.excludedBranchIds.length
          ? not(inArray(schema.branches.id, intelligentPolicy.value.excludedBranchIds))
          : undefined,
      ));
    requestedBranchIds = tenantWideBranches.map((branch) => branch.id);
    balanceAcrossBranches = requestedBranchIds.length > 1;
  }
  const activeBranches = await db.select({ id: schema.branches.id, status: schema.branches.status, acceptingLeads: schema.branches.acceptingLeads, autoDistribute: schema.branches.autoDistribute, isDistributionHub: schema.branches.isDistributionHub }).from(schema.branches).where(and(eq(schema.branches.tenantId, context.tenantId), inArray(schema.branches.id, requestedBranchIds)));
  const configuredTargetBranchId = queue?.branchId ?? lead.branchId;
  const branchToActivate = configuredTargetBranchId
    ? activeBranches.find((branch) => branch.id === configuredTargetBranchId && branch.status === "active" && branch.acceptingLeads && !branch.isDistributionHub && !branch.autoDistribute)
    : null;
  if (branchToActivate) {
    await db.transaction(async (tx) => {
      await tx.update(schema.branches).set({ autoDistribute: true, updatedAt: new Date() })
        .where(and(eq(schema.branches.id, branchToActivate.id), eq(schema.branches.tenantId, context.tenantId)));
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "branch", entidadeId: branchToActivate.id, acao: "branch.auto_distribution_enabled_by_intake" });
    });
    branchToActivate.autoDistribute = true;
  }
  let targetBranchIds = activeBranches.filter(isAutomaticDistributionBranch).map((branch) => branch.id);
  if (!targetBranchIds.length) {
    return { status: "queued", leadId, reason: "Nenhuma unidade elegível está ativa para esta fila." };
  }
  const allowedBrokerSet = intelligentPolicy.value.allowedBrokerIds?.length ? new Set(intelligentPolicy.value.allowedBrokerIds) : null;
  const exclusiveScheduleIds = queue?.exclusiveDutyScheduleIds?.length
    ? queue.exclusiveDutyScheduleIds
    : queue?.exclusiveDutyScheduleId
      ? [queue.exclusiveDutyScheduleId]
      : null;
  const loadEligibleBrokers = async (branchIds: string[]) => {
    const allBrokers = await db
      .select({
        id: schema.user.id,
        branchId: schema.tenantMemberships.branchId,
        createdAt: schema.user.createdAt,
      })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .innerJoin(
        schema.brokerProfiles,
        and(
          eq(schema.brokerProfiles.userId, schema.user.id),
          eq(schema.brokerProfiles.tenantId, context.tenantId),
          isNotNull(schema.brokerProfiles.phone),
        ),
      )
      .where(and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        inArray(schema.tenantMemberships.branchId, branchIds),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
        eq(schema.tenantMemberships.availabilityStatus, "available"),
        eq(schema.user.active, true),
        eq(schema.user.status, "active"),
      ))
      .orderBy(asc(schema.user.createdAt));
    const rosterResults = await Promise.all(branchIds.map(async (branchId) => [branchId, await getRosterBrokerIds(context.tenantId, branchId, new Date(), lead.webhookCredentialId, exclusiveScheduleIds, (queue?.dutyFallbackPolicy as DutyFallbackPolicy | undefined) ?? (exclusiveScheduleIds?.length ? "wait_next_duty" : "unit_roster"))] as const));
    const rosterByBranch = new Map(rosterResults.map(([branchId, result]) => [branchId, result.brokerIds] as const));
    const hasActiveSelectedSchedule = rosterResults.some(([, result]) => result.hasActiveSelectedSchedule);
    const brokers = allBrokers.filter((broker) => {
      const rosterBrokerIds = broker.branchId ? rosterByBranch.get(broker.branchId) : null;
      return (!rosterBrokerIds || rosterBrokerIds.has(broker.id)) && broker.id !== brokerToExclude && !intelligentPolicy.value.excludedBrokerIds.includes(broker.id) && (!allowedBrokerSet || allowedBrokerSet.has(broker.id));
    });
    return { brokers, rosterByBranch, hasActiveSelectedSchedule };
  };

  let { brokers, rosterByBranch, hasActiveSelectedSchedule } = await loadEligibleBrokers(targetBranchIds);
  const dutyFallbackPolicy = (queue?.dutyFallbackPolicy as DutyFallbackPolicy | undefined)
    ?? (exclusiveScheduleIds?.length ? "wait_next_duty" : "unit_roster");
  if (!brokers.length && exclusiveScheduleIds?.length && !hasActiveSelectedSchedule && dutyFallbackPolicy === "fallback_queue") {
    const fallbackQueueId = queue?.dutyFallbackQueueId;
    if (!fallbackQueueId || fallbackQueueId === lead.queueId) {
      return { status: "queued", leadId, reason: "A fila de contingência não está configurada corretamente." };
    }
    const fallbackQueue = await db
      .select({ id: schema.leadQueues.id, branchId: schema.leadQueues.branchId })
      .from(schema.leadQueues)
      .where(and(
        eq(schema.leadQueues.id, fallbackQueueId),
        eq(schema.leadQueues.tenantId, context.tenantId),
        eq(schema.leadQueues.status, "active"),
        isNull(schema.leadQueues.deletedAt),
      ))
      .limit(1);
    if (!fallbackQueue[0]) return { status: "queued", leadId, reason: "A fila de contingência não está ativa." };
    const routedAt = new Date();
    await db.transaction(async (tx) => {
      await tx.update(schema.leads)
        .set({ queueId: fallbackQueue[0].id, distributionUpdatedAt: routedAt, updatedAt: routedAt })
        .where(and(
          eq(schema.leads.id, leadId),
          eq(schema.leads.tenantId, context.tenantId),
          lead.queueId ? eq(schema.leads.queueId, lead.queueId) : isNull(schema.leads.queueId),
        ));
      await tx.insert(schema.leadDistributionEvents).values({
        id: randomUUID(),
        tenantId: context.tenantId,
        leadId,
        fromBranchId: lead.branchId,
        toBranchId: fallbackQueue[0].branchId ?? lead.branchId,
        fromQueueId: lead.queueId,
        toQueueId: fallbackQueue[0].id,
        action: "queue_duty_fallback",
        source: "automatic",
        strategy: "automatic",
        reason: "Nenhum plantão selecionado está ativo; lead encaminhado para a fila de contingência.",
        actorId: context.userId,
        metadata: { dutyFallbackPolicy, sourceQueueId: lead.queueId, fallbackQueueId: fallbackQueue[0].id },
        createdAt: routedAt,
      });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_distribution", entidadeId: leadId, acao: "lead.queue_duty_fallback" });
    });
    return processQueuedLead(context, leadId, excludeBrokerId, fallbackDepth + 1);
  }
  let fallbackUnitUsed = false;
  if (!brokers.length && context.role === "director") {
    // A unit with no available eligible broker must not strand the lead. Expand
    // only after the primary unit is empty, preserving the configured order.
    const fallbackBranches = await db
      .select({ id: schema.branches.id })
      .from(schema.branches)
      .where(and(
        eq(schema.branches.tenantId, context.tenantId),
        eq(schema.branches.status, "active"),
        eq(schema.branches.acceptingLeads, true),
        eq(schema.branches.autoDistribute, true),
        eq(schema.branches.isDistributionHub, false),
        ...((intelligentPolicy.value.allowedBranchIds?.length)
          ? [inArray(schema.branches.id, intelligentPolicy.value.allowedBranchIds)]
          : []),
        ...(intelligentPolicy.value.excludedBranchIds.length
          ? [not(inArray(schema.branches.id, intelligentPolicy.value.excludedBranchIds))]
          : []),
      ));
    const fallbackIds = fallbackBranches.map((branch) => branch.id).filter((id) => !targetBranchIds.includes(id));
    if (fallbackIds.length) {
      const fallback = await loadEligibleBrokers(fallbackIds);
      if (fallback.brokers.length) {
        targetBranchIds = fallbackIds;
        brokers = fallback.brokers;
        rosterByBranch = fallback.rosterByBranch;
        hasActiveSelectedSchedule = fallback.hasActiveSelectedSchedule;
        fallbackUnitUsed = true;
      }
    }
  }
  if (!brokers.length) {
    return { status: "queued", leadId, reason: "Nenhum corretor elegível nesta unidade." };
  }

  if (balanceAcrossBranches && context.role === "director") {
    const eligibleBranchIds = Array.from(new Set(brokers.map((broker) => broker.branchId).filter((branchId): branchId is string => Boolean(branchId))));
    let selectedBranchId: string | null = null;
    let routingError: string | null = null;
    const reservation = await db.transaction(async (tx) => reserveDistributionBranch({
      withLock: async (work) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${context.tenantId}), hashtext('automatic-unit-routing'))`);
        return work();
      },
      getCandidates: async () => {
        const [lockedLead] = await tx.select({ branchId: schema.leads.branchId, corretorId: schema.leads.corretorId })
          .from(schema.leads)
          .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt)))
          .for("update")
          .limit(1);
        if (!lockedLead) {
          routingError = "Lead não encontrado para roteamento.";
          return [];
        }
        if (lockedLead.corretorId) {
          routingError = "O lead recebeu um corretor enquanto a unidade era resolvida.";
          selectedBranchId = lockedLead.branchId;
          return [];
        }

        const [priorAutoRoute] = await tx.select({ toBranchId: schema.leadDistributionEvents.toBranchId })
          .from(schema.leadDistributionEvents)
          .where(and(
            eq(schema.leadDistributionEvents.tenantId, context.tenantId),
            eq(schema.leadDistributionEvents.leadId, leadId),
            eq(schema.leadDistributionEvents.action, "auto_routed_to_unit"),
            lead.queueId ? eq(schema.leadDistributionEvents.toQueueId, lead.queueId) : isNull(schema.leadDistributionEvents.toQueueId),
          ))
          .orderBy(desc(schema.leadDistributionEvents.createdAt))
          .limit(1);
        if (priorAutoRoute?.toBranchId && lockedLead.branchId === priorAutoRoute.toBranchId && eligibleBranchIds.includes(priorAutoRoute.toBranchId)) {
          selectedBranchId = priorAutoRoute.toBranchId;
          return [];
        }

        const candidateBranches = await tx.select({ id: schema.branches.id, createdAt: schema.branches.createdAt })
          .from(schema.branches)
          .where(and(
            eq(schema.branches.tenantId, context.tenantId),
            inArray(schema.branches.id, eligibleBranchIds),
            eq(schema.branches.status, "active"),
            eq(schema.branches.acceptingLeads, true),
            eq(schema.branches.autoDistribute, true),
            eq(schema.branches.isDistributionHub, false),
            intelligentPolicy.value.excludedBranchIds.length
              ? not(inArray(schema.branches.id, intelligentPolicy.value.excludedBranchIds))
              : undefined,
          ));
        if (!candidateBranches.length) return [];

        const branchLoads = await tx.select({ branchId: schema.leads.branchId, total: count(schema.leads.id) })
          .from(schema.leads)
          .where(and(
            eq(schema.leads.tenantId, context.tenantId),
            inArray(schema.leads.branchId, candidateBranches.map((branch) => branch.id)),
            isNull(schema.leads.deletedAt),
            isNull(schema.leads.archivedAt),
            ne(schema.leads.id, leadId),
          ))
          .groupBy(schema.leads.branchId);
        const loadMap = new Map(branchLoads.map((row) => [row.branchId, Number(row.total)]));
        return candidateBranches.map((branch) => ({ ...branch, receivedLeads: loadMap.get(branch.id) ?? 0 }));
      },
      reserve: async (branch) => {
        const [lockedLead] = await tx.select({ branchId: schema.leads.branchId, corretorId: schema.leads.corretorId })
          .from(schema.leads)
          .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)))
          .limit(1);
        if (!lockedLead || lockedLead.corretorId) {
          routingError = "O lead recebeu um corretor enquanto a unidade era resolvida.";
          selectedBranchId = lockedLead?.branchId ?? null;
          return null;
        }
        const routedAt = new Date();
        const [updatedLead] = await tx.update(schema.leads)
          .set({ branchId: branch.id, unitAssignedAt: routedAt, distributionUpdatedAt: routedAt })
          .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt)))
          .returning({ id: schema.leads.id });
        if (!updatedLead) {
          routingError = "O lead mudou durante o roteamento; ele será reavaliado pelo próximo ciclo.";
          return null;
        }
        await tx.insert(schema.leadDistributionEvents).values({
          id: randomUUID(),
          tenantId: context.tenantId,
          leadId,
          fromBranchId: lockedLead.branchId,
          toBranchId: branch.id,
          fromQueueId: lead.queueId,
          toQueueId: lead.queueId,
          action: "auto_routed_to_unit",
          source: "automatic",
          strategy: "capacity",
          reason: "Unidade elegível com menos leads recebidos; seleção protegida contra concorrência.",
          actorId: context.userId,
          metadata: { receivedLeadsBeforeRouting: branch.receivedLeads },
          createdAt: routedAt,
        });
        await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_distribution", entidadeId: leadId, acao: "lead.auto_routed_to_unit" });
        selectedBranchId = branch.id;
        return { branchId: branch.id };
      },
    }));

    if (routingError) return { status: "conflict", leadId, reason: routingError };
    if (reservation.status === "reserved") selectedBranchId = reservation.value?.branchId ?? selectedBranchId;
    if (!selectedBranchId) return { status: "queued", leadId, reason: "Nenhuma unidade elegível possui corretor disponível neste momento." };
    lead.branchId = selectedBranchId;
    brokers = brokers.filter((broker) => broker.branchId === selectedBranchId);
    targetBranchIds = [selectedBranchId];
  }

  const offerHistory = await db
    .select({
      brokerId: schema.leadOffers.brokerId,
      status: schema.leadOffers.status,
      offeredAt: schema.leadOffers.offeredAt,
      expiresAt: schema.leadOffers.expiresAt,
      outboundMessageId: schema.leadOffers.outboundMessageId,
    })
    .from(schema.leadOffers)
    .where(and(eq(schema.leadOffers.tenantId, context.tenantId), eq(schema.leadOffers.leadId, leadId)));
  const offerCycle = resolveLeadOfferCycle({
    eligibleBrokerIds: brokers.map((broker) => broker.id),
    offers: offerHistory,
    cycleStartedAt: lead.distributionUpdatedAt,
  });
  if (offerCycle.activeBrokerId && offerCycle.activeExpiresAt) {
    return {
      status: "offered",
      leadId,
      brokerId: offerCycle.activeBrokerId,
      expiresAt: offerCycle.activeExpiresAt,
      reason: "Oferta ativa aguardando resposta do corretor.",
    };
  }

  const attemptedBrokerIds = offerCycle.attemptedBrokerIds;
  const remainingBrokerSet = new Set(offerCycle.remainingBrokerIds);
  const remainingBrokers = brokers.filter((broker) => remainingBrokerSet.has(broker.id));
  if (offerCycle.exhausted) {
    const manualAt = new Date();
    const reason = "Todos os corretores elegíveis concluíram este ciclo sem aceite. Um novo ciclo automático foi iniciado.";
    const restartedCycle = await db.transaction(async (tx) => {
      const changed = await tx
        .update(schema.leads)
        .set({
          assignmentSource: "automatic_offer",
          distributionUpdatedAt: manualAt,
        })
        .where(
          and(
            eq(schema.leads.id, leadId),
            eq(schema.leads.tenantId, context.tenantId),
            lead.corretorId ? eq(schema.leads.corretorId, lead.corretorId) : isNull(schema.leads.corretorId),
          ),
        )
        .returning({ id: schema.leads.id });
      if (!changed.length) return false;

      await tx.insert(schema.leadDistributionEvents).values({
        id: randomUUID(),
        tenantId: context.tenantId,
        leadId,
        fromBranchId: lead.branchId,
        toBranchId: lead.branchId,
        fromQueueId: lead.queueId,
        toQueueId: lead.queueId,
        action: "offer_cycle_restarted",
        source: "redistribution",
        strategy: "automatic",
        reason,
        actorId: context.userId,
        metadata: { attemptedBrokerIds: Array.from(attemptedBrokerIds) },
        createdAt: manualAt,
      });
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "lead_distribution",
        entidadeId: leadId,
        acao: "lead.offer_cycle_restarted",
      });
      return true;
    });

    if (!restartedCycle) return { status: "conflict", leadId, reason: "O estado do lead mudou durante a redistribuição." };
    return processQueuedLead(context, leadId, excludeBrokerId ?? lead.corretorId);
  }

  const ids = remainingBrokers.map((broker) => broker.id);
  const [loads, brokerLeadHistory, slaAttempts] = await Promise.all([
    db.select({ brokerId: schema.leads.corretorId, total: count(schema.leads.id) }).from(schema.leads).where(and(
      eq(schema.leads.tenantId, context.tenantId),
      inArray(schema.leads.corretorId, ids),
      inArray(schema.leads.status, activeCommercialStatuses),
      lead.queueId ? eq(schema.leads.queueId, lead.queueId) : isNull(schema.leads.queueId),
      isNull(schema.leads.deletedAt),
      isNull(schema.leads.archivedAt),
    )).groupBy(schema.leads.corretorId),
    db.select({ brokerId: schema.leads.corretorId, status: schema.leads.status, assignedAt: schema.leads.assignedAt, serviceStartedAt: schema.leads.serviceStartedAt, firstContactAt: schema.leads.firstContactAt }).from(schema.leads).where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.corretorId, ids))),
    db.select({ brokerId: schema.leadAssignmentAttempts.brokerId, assignedAt: schema.leadAssignmentAttempts.assignedAt, firstContactAt: schema.leadAssignmentAttempts.firstContactAt, feedbackDueAt: schema.leadAssignmentAttempts.feedbackDueAt }).from(schema.leadAssignmentAttempts).where(and(eq(schema.leadAssignmentAttempts.tenantId, context.tenantId), inArray(schema.leadAssignmentAttempts.brokerId, ids))),
  ]);
  const loadMap = new Map(loads.map((item) => [item.brokerId, Number(item.total)]));
  const candidates = remainingBrokers.map((broker) => {
    const history = brokerLeadHistory.filter((item) => item.brokerId === broker.id);
    const attempts = slaAttempts.filter((item) => item.brokerId === broker.id);
    const conversionRate = history.length ? history.filter((item) => item.status === "converted").length / history.length : 0;
    const slaRate = attempts.length ? attempts.filter((item) => item.firstContactAt && item.firstContactAt <= item.feedbackDueAt).length / attempts.length : 0;
    const idleSince = [...history.map((item) => item.assignedAt), ...attempts.map((item) => item.assignedAt)].reduce<Date | null>((newest, assignedAt) => !assignedAt ? newest : (!newest || assignedAt > newest ? assignedAt : newest), null);
    const unstartedLeads = history.filter((item) => item.status === "distributed" || item.status === "new" || (!item.serviceStartedAt && !item.firstContactAt)).length + attempts.filter((item) => !item.firstContactAt).length;
    const candidate = { id: broker.id, createdAt: broker.createdAt, activeLeads: loadMap.get(broker.id) ?? 0, unstartedLeads, lastAssignedAt: idleSince, capacity: queue?.capacityEnabled ? queue.capacity ?? null : null, onDuty: Boolean(broker.branchId && rosterByBranch.get(broker.branchId)?.has(broker.id)), conversionRate, slaRate, manualPriority: 0, idleSince, rankingScore: 0 };
    return { ...candidate, rankingScore: calculateBrokerRankingScore(candidate, intelligentPolicy.value) };
  });
  // Offer pacing: a broker that just received an offer (or still has one
  // awaiting a response) is skipped, so a released backlog is delivered one
  // lead per broker per interval instead of in a single burst.
  const pacing = lead.queueId && queue ? normalizeOfferPacing({ intervalMinutes: queue.offerIntervalMinutes, maxPending: queue.maxPendingOffers }) : null;
  const pacingDecisions = new Map<string, OfferPacingDecision>();
  if (pacing && lead.queueId && isOfferPacingEnabled(pacing)) {
    const pacingNow = new Date();
    const recentOffers = await loadBrokerPacingOffers(db, { tenantId: context.tenantId, queueId: lead.queueId, brokerIds: ids, intervalMinutes: pacing.intervalMinutes, now: pacingNow });
    for (const brokerId of ids) pacingDecisions.set(brokerId, evaluateBrokerOfferPacing(recentOffers.get(brokerId) ?? [], pacing, pacingNow));
  }
  const pacedOut = candidates.filter((candidate) => pacingDecisions.get(candidate.id)?.allowed === false);
  const paceableCandidates = pacedOut.length ? candidates.filter((candidate) => pacingDecisions.get(candidate.id)?.allowed !== false) : candidates;
  const decision = resolveDistributionCandidate(paceableCandidates, intelligentPolicy.value, queue?.strategy === "round_robin" ? "round_robin" : "capacity");
  // Capacity is a hard per-queue limit. When every eligible broker is full,
  // keep this lead queued rather than assigning above the configured limit.
  const chosen = decision.selected;
  if (!chosen) {
    // Only paced-out brokers still have room: wait for the earliest release
    // instead of reporting a capacity/eligibility problem.
    const waitingForPacing = pacedOut.filter((candidate) => candidate.capacity === null || candidate.activeLeads < candidate.capacity);
    if (waitingForPacing.length) {
      return {
        status: "queued",
        leadId,
        reason: "Aguardando intervalo entre ofertas: os corretores elegíveis receberam um lead há pouco ou ainda têm oferta pendente.",
        retryAt: earliestPacingRetryAt(waitingForPacing.map((candidate) => pacingDecisions.get(candidate.id)!)) ?? undefined,
      };
    }
    return {
      status: "queued",
      leadId,
      reason: queue?.capacityEnabled
        ? "Todos os corretores elegíveis atingiram o limite desta fila; o lead continuará aguardando sem exceder a capacidade."
        : "Nenhum corretor elegível nesta unidade.",
    };
  }
  const chosenBranchId = remainingBrokers.find((broker) => broker.id === chosen.id)?.branchId ?? lead.branchId;
  if (!chosenBranchId) return { status: "queued", leadId, reason: "A unidade do corretor selecionado não foi encontrada." };

  const offer = await createLeadOffersForBrokers({
    tenantId: context.tenantId,
    leadId,
    brokerIds: [chosen.id, ...decision.eligible.filter((candidate) => candidate.id !== chosen.id).map((candidate) => candidate.id)],
    requestedBy: context.userId,
    expectedCurrentBrokerId: lead.corretorId,
    targetBranchId: chosenBranchId,
    cycleStartedAt: lead.distributionUpdatedAt,
    queueId: lead.queueId,
    capacityPerBroker: queue?.capacityEnabled ? queue.capacity ?? null : null,
    pacing,
  });
  if (!offer.createdOffers.length) {
    if (offer.pacingBlocked && !offer.capacityReached) {
      return { status: "queued", leadId, reason: "Aguardando intervalo entre ofertas: outro processo acabou de ofertar um lead ao corretor.", retryAt: new Date(Date.now() + 30_000) };
    }
    if (offer.capacityReached) {
      return {
        status: "queued",
        leadId,
        reason: "Todos os corretores elegíveis atingiram o limite desta fila; o lead continuará aguardando sem exceder a capacidade.",
      };
    }
    const [activeOffer] = await db
      .select({
        brokerId: schema.leadOffers.brokerId,
        expiresAt: schema.leadOffers.expiresAt,
        outboundMessageId: schema.leadOffers.outboundMessageId,
      })
      .from(schema.leadOffers)
      .where(
        and(
          eq(schema.leadOffers.tenantId, context.tenantId),
          eq(schema.leadOffers.leadId, leadId),
          inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
          isNotNull(schema.leadOffers.outboundMessageId),
          gt(schema.leadOffers.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (activeOffer) {
      return {
        status: "offered",
        leadId,
        brokerId: activeOffer.brokerId,
        expiresAt: activeOffer.expiresAt,
        outboundMessageId: activeOffer.outboundMessageId ?? undefined,
        reason: "Oferta ativa aguardando resposta do corretor.",
      };
    }

    // A broker without a usable corporate channel is recorded as an attempted
    // offer (CANCELLED). Re-evaluate immediately so the lead advances to the
    // next eligible broker instead of consuming a scheduler retry.
    return processQueuedLead(context, leadId, chosen.id);
  }

  return {
    status: "offered",
    leadId,
    brokerId: chosen.id,
    expiresAt: offer.expiresAt,
    outboundMessageId: offer.createdOffers[0]?.whatsappMessageId,
    reason: fallbackUnitUsed
      ? "Unidade sem corretor elegível; lead avançou para a próxima unidade disponível."
      : attemptedBrokerIds.size > 0
        ? "Oferta enviada ao próximo corretor elegível."
        : "Oferta enviada ao primeiro corretor elegível.",
  };
}

/** Cria uma oferta exclusiva escolhida pelo gestor sem confirmar a atribuição antes do aceite. */
export async function offerLeadToBrokerManually(context: TenantContext, leadId: string, brokerId: string) {
  if (!canManage(context)) throw new AuthorizationError("Apenas Gestores e Diretores podem oferecer leads.");
  const db = getDatabase();
  const [lead] = await db.select({
    id: schema.leads.id,
    nome: schema.leads.nome,
    branchId: schema.leads.branchId,
    queueId: schema.leads.queueId,
    webhookCredentialId: schema.leads.webhookCredentialId,
    corretorId: schema.leads.corretorId,
    deletedAt: schema.leads.deletedAt,
    archivedAt: schema.leads.archivedAt,
    status: schema.leads.status,
    assignmentSource: schema.leads.assignmentSource,
  }).from(schema.leads).where(and(
    eq(schema.leads.id, leadId),
    eq(schema.leads.tenantId, context.tenantId),
  )).limit(1);
  if (!lead || lead.deletedAt || lead.archivedAt) return { status: "conflict" as const, reason: "Lead não encontrado ou indisponível." };
  if (lead.corretorId) return { status: "conflict" as const, reason: "Este lead já possui corretor. Atualize a lista antes de continuar." };
  if (!["new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(lead.status)) {
    return { status: "conflict" as const, reason: "Leads encerrados não podem receber uma nova oferta." };
  }
  if (!lead.branchId) return { status: "conflict" as const, reason: "Envie o lead para uma unidade antes de oferecer a um corretor." };
  assertBranchScope(context, lead.branchId);
  if (lead.queueId) {
    const campaignCheck = await validateCampaignQueueRoute(db, context.tenantId, leadId, lead.queueId);
    if (!campaignCheck.allowed) return { status: "conflict" as const, reason: campaignCheck.reason ?? "Campanha não permitida para esta fila." };
  }

  const dutyRoster = await getActiveQueueDutyRoster({
    tenantId: context.tenantId,
    queueId: lead.queueId,
    webhookCredentialId: lead.webhookCredentialId,
  });
  const [broker] = await db.select({
    id: schema.user.id,
    phone: schema.brokerProfiles.phone,
    branchId: schema.tenantMemberships.branchId,
    availabilityStatus: schema.tenantMemberships.availabilityStatus,
  }).from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .leftJoin(schema.brokerProfiles, and(
      eq(schema.brokerProfiles.userId, schema.user.id),
      eq(schema.brokerProfiles.tenantId, context.tenantId),
    ))
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId),
      eq(schema.tenantMemberships.userId, brokerId),
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.jobTitle, "broker"),
      eq(schema.tenantMemberships.status, "active"),
      eq(schema.tenantMemberships.availabilityStatus, "available"),
      eq(schema.user.active, true),
      eq(schema.user.status, "active"),
    )).limit(1);
  if (!broker) return { status: "conflict" as const, reason: "O corretor não está ativo neste tenant." };
  const isOnDuty = dutyRoster.hasActiveDuty && dutyRoster.brokers.some((candidate) => candidate.id === brokerId);
  if (dutyRoster.hasActiveDuty ? !isOnDuty : broker.branchId !== lead.branchId || broker.availabilityStatus !== "available") {
    return { status: "conflict" as const, reason: dutyRoster.hasActiveDuty ? "O corretor não está escalado no plantão ativo desta fila." : "O corretor não está ativo e disponível nesta unidade." };
  }
  if (!broker.phone) return { status: "fallback" as const, reason: "O corretor não possui telefone para receber a oferta. O lead voltará à distribuição normal." };

  const [tenant] = await db.select({ slaFirstContactMinutes: schema.tenants.slaFirstContactMinutes })
    .from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1);
  const [queue] = lead.queueId ? await db.select({ capacityEnabled: schema.leadQueues.capacityEnabled, capacityPerBroker: schema.leadQueues.capacityPerBroker })
    .from(schema.leadQueues).where(and(eq(schema.leadQueues.id, lead.queueId), eq(schema.leadQueues.tenantId, context.tenantId))).limit(1) : [];
  const capacity = queue?.capacityEnabled ? queue.capacityPerBroker : null;
  if (capacity !== null && capacity !== undefined) {
    const [activeCount] = await db.select({ total: count(schema.leads.id) }).from(schema.leads).where(and(
      eq(schema.leads.tenantId, context.tenantId),
      eq(schema.leads.queueId, lead.queueId!),
      eq(schema.leads.corretorId, brokerId),
      inArray(schema.leads.status, activeCommercialStatuses),
      isNull(schema.leads.deletedAt),
      isNull(schema.leads.archivedAt),
    ));
    if (Number(activeCount?.total ?? 0) >= capacity) return { status: "conflict" as const, reason: "Este corretor atingiu o limite de leads ativos desta fila." };
  }

  const now = new Date();
  const result = await createLeadOffersForBrokers({
    tenantId: context.tenantId,
    leadId,
    brokerIds: [brokerId],
    responseTimeoutMinutes: Number.parseInt(tenant?.slaFirstContactMinutes ?? "15", 10) || 15,
    requestedBy: context.userId,
    expectedCurrentBrokerId: null,
    targetBranchId: lead.branchId,
    cycleStartedAt: now,
    queueId: lead.queueId,
    capacityPerBroker: capacity,
    assignmentSource: "manual_offer",
  });
  if (!result.created) {
    const [activeOffer] = await db.select({ id: schema.leadOffers.id, expiresAt: schema.leadOffers.expiresAt })
      .from(schema.leadOffers).where(and(
        eq(schema.leadOffers.tenantId, context.tenantId),
        eq(schema.leadOffers.leadId, leadId),
        eq(schema.leadOffers.brokerId, brokerId),
        inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
        gt(schema.leadOffers.expiresAt, new Date()),
      )).limit(1);
    if (activeOffer) return { status: "conflict" as const, reason: "Já existe uma oferta ativa para este lead. Aguarde a resposta antes de tentar novamente." };
    return { status: "fallback" as const, reason: "Não foi possível entregar a oferta. O lead voltará à distribuição normal." };
  }
  return { status: "offered" as const, brokerId, expiresAt: result.expiresAt };
}

export async function distributeQualifiedLead(input: {
  tenantId: string;
  leadId: string;
  actorUserId?: string | null;
}) {
  const db = getDatabase();
  const [lead] = await db
    .select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      branchId: schema.leads.branchId,
      qualificationStatus: schema.leads.qualificationStatus,
      qualificationScore: schema.leads.qualificationScore,
      queueId: schema.leads.queueId,
      corretorId: schema.leads.corretorId,
      archivedAt: schema.leads.archivedAt,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId), isNull(schema.leads.archivedAt)))
    .limit(1);

  if (!lead) return { distributed: false, reason: "lead_not_found" };
  if (lead.corretorId) return { distributed: true, brokerId: lead.corretorId, reason: "already_assigned" };

  const { resolveQualificationDestination } = await import("@/features/ai-qualification/destination-routing-service");

  const classification = (["hot", "warm", "cold", "not_qualified"].includes(lead.qualificationStatus)
    ? lead.qualificationStatus
    : "warm") as "hot" | "warm" | "cold" | "not_qualified";

  const destination = await resolveQualificationDestination({
    tenantId: input.tenantId,
    classification,
    score: lead.qualificationScore ?? 50,
  });

  if (destination.destinationType === "no_distribution" || destination.destinationType === "close") {
    await db.update(schema.leads).set({
      distributionStatus: "closed",
      updatedAt: new Date(),
    }).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)));

    return { distributed: false, destination, reason: "destination_closed_or_no_distribution" };
  }

  const [distributionDirector] = await db.select({ id: schema.tenantMemberships.userId }).from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.tenantId, input.tenantId), eq(schema.tenantMemberships.role, "director"), eq(schema.tenantMemberships.status, "active")))
    .orderBy(asc(schema.tenantMemberships.createdAt)).limit(1);
  const distributionActorId = input.actorUserId ?? distributionDirector?.id;
  if (!distributionActorId) return { distributed: false, destination, reason: "no_distribution_actor" };
  const distributionContext: TenantContext = { tenantId: input.tenantId, userId: distributionActorId, role: "director", jobTitle: "director", branchId: lead.branchId };
  const routedQualifiedLead = lead.queueId || !lead.branchId
    ? { status: "routed" as const }
    : await routeLeadToBranch(distributionContext, input.leadId, lead.branchId, `Qualification completed (${classification.toUpperCase()})`);
  if (routedQualifiedLead.status !== "routed") return { distributed: false, destination, reason: `routing_${routedQualifiedLead.status}` };
  const { enqueueLeadDistributionJob } = await import("./jobs");
  await enqueueLeadDistributionJob({ tenantId: input.tenantId, leadId: input.leadId });
  const routedAssignment = await processQueuedLead(distributionContext, input.leadId);
  if (routedAssignment.status === "queued") {
    // A qualified lead is never discarded because the roster is empty. Keep
    // its qualification and queue position until a broker becomes eligible.
    await db.update(schema.leads).set({
      distributionStatus: "queued",
      distributionUpdatedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)));
    console.info("[distribute-qualified] queued_waiting_for_broker", {
      tenantId: input.tenantId,
      leadId: input.leadId,
      reason: routedAssignment.reason,
    });
  }
  return {
    distributed: routedAssignment.status === "assigned" || routedAssignment.status === "offered",
    brokerId: routedAssignment.status === "assigned" || routedAssignment.status === "offered" ? routedAssignment.brokerId : null,
    destination,
    assignedResult: routedAssignment,
  };

}
