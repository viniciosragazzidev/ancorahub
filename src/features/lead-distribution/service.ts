import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, count, eq, gt, inArray, isNotNull, isNull, lte, not, or } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { AuthorizationError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/types";
import { calculateBrokerRankingScore, defaultIntelligentDistributionPolicy, isAutomaticDistributionBranch, resolveDistributionCandidate, resolveDistributionPolicyScope, resolveLeadOfferCycle, resolveQueueCandidateBranchIds, selectDistributionBranch, type IntelligentDistributionPolicy } from "./domain";
import type { AssignmentSource, LeadAssignmentResult, LeadRoutingResult } from "./types";
import { enqueueLeadEffectTx } from "@/features/leads/webhooks/services/lead-effect-outbox";
import { createLeadOffersForBrokers } from "./offers";

const activeCommercialStatuses = ["distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;

function canManage(context: TenantContext) {
  return context.role === "director" || context.role === "manager";
}

function assertBranchScope(context: TenantContext, branchId: string) {
  if (context.role === "manager" && context.branchId !== branchId) throw new AuthorizationError("Você só pode operar leads da sua unidade.");
}

import { getLocalDutyParts } from "@/features/leads/assignment";

async function getRosterBrokerIds(tenantId: string, branchId: string, date = new Date(), webhookCredentialId?: string | null) {
  const db = getDatabase();
  const local = getLocalDutyParts(date);

  // 1. Find plantões active right now for this branch
  const activeSchedules = await db.select({ id: schema.unitDutySchedules.id, webhookCredentialId: schema.unitDutySchedules.webhookCredentialId })
    .from(schema.unitDutySchedules)
    .where(and(
      eq(schema.unitDutySchedules.tenantId, tenantId),
      eq(schema.unitDutySchedules.branchId, branchId),
      eq(schema.unitDutySchedules.dayOfWeek, local.weekday),
      eq(schema.unitDutySchedules.status, "active"),
      lte(schema.unitDutySchedules.startsAt, local.time),
      gt(schema.unitDutySchedules.endsAt, local.time),
      lte(schema.unitDutySchedules.validFrom, date),
      or(isNull(schema.unitDutySchedules.validUntil), gt(schema.unitDutySchedules.validUntil, date)),
    ));

  // No plantões at all → fallback to all brokers (legacy behavior)
  if (!activeSchedules.length) return null;

  // 2. Filter plantões by credential if the lead has a source
  const matchingScheduleIds = webhookCredentialId
    ? activeSchedules.filter((s) => s.webhookCredentialId === webhookCredentialId).map((s) => s.id)
    : activeSchedules.filter((s) => s.webhookCredentialId === null).map((s) => s.id);

  // Plantões exist for this branch but none match the credential → no brokers eligible
  if (!matchingScheduleIds.length) return new Set<string>();

  // 3. Get brokers assigned to matching plantões right now
  const assignments = await db.select({ brokerId: schema.dutyRosterAssignments.brokerId })
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
  return new Set(assignments.map((a) => a.brokerId));
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
  const [lead] = await db.select({ id: schema.leads.id, branchId: schema.leads.branchId, corretorId: schema.leads.corretorId, metaCampaignId: schema.leads.metaCampaignId, sourceCampaign: schema.leads.sourceCampaign }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  if (!lead) return { status: "failed", code: "LEAD_NOT_FOUND" };

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
    const result = await tx.update(schema.leads).set(updateData).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.corretorId))).returning({ id: schema.leads.id });
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
    .select({ id: schema.leads.id, nome: schema.leads.nome, branchId: schema.leads.branchId, corretorId: schema.leads.corretorId })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)))
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
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.corretorId)))
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

export async function assignLeadToBroker(context: TenantContext, leadId: string, brokerId: string, source?: AssignmentSource, reason = "Atribuição manual", excludeBrokerId?: string | null, targetBranchId?: string): Promise<LeadAssignmentResult> {
  if (!canManage(context)) throw new AuthorizationError("Apenas Gestores e Diretores podem atribuir leads.");
  const db = getDatabase();
  const [lead] = await db.select({ id: schema.leads.id, nome: schema.leads.nome, branchId: schema.leads.branchId, queueId: schema.leads.queueId, corretorId: schema.leads.corretorId, distributionOrigin: schema.leads.distributionOrigin }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  if (!lead) return { status: "conflict", leadId, reason: "Lead não encontrado." };
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
    const result = await tx.update(schema.leads).set({ branchId: assignmentBranchId, corretorId: brokerId, status: "distributed", distributionStatus: "assigned", distributionOrigin: source === "manual_director" ? "parent" : source === "manual_manager" ? "unit" : lead.distributionOrigin ?? (context.role === "director" ? "parent" : "unit"), assignedAt, assignmentSource: source ?? (context.role === "director" ? "manual_director" : "manual_manager"), assignmentStrategy: "manual", distributionUpdatedAt: assignedAt, firstContactAt: null, serviceStartedAt: null, serviceStartedBy: null, stageEnteredAt: assignedAt, motivoPerda: null }).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), lead.corretorId ? eq(schema.leads.corretorId, lead.corretorId) : isNull(schema.leads.corretorId))).returning({ id: schema.leads.id });
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
      },
    });
    return true;
  });
  return assigned
    ? { status: "assigned", leadId, brokerId, strategy: "manual" }
    : { status: "conflict", leadId, reason: "Este lead já foi atribuído. Atualize a fila." };
}

export async function processQueuedLead(context: TenantContext, leadId: string, excludeBrokerId?: string | null): Promise<LeadAssignmentResult> {
  if (!canManage(context)) throw new AuthorizationError("Você não pode executar a distribuição automática.");
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
    distributionUpdatedAt: schema.leads.distributionUpdatedAt,
    corretorId: schema.leads.corretorId,
    assignmentSource: schema.leads.assignmentSource,
  }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  if (!lead) return { status: "queued", leadId, reason: "Lead não encontrado." };
  const canRotateCurrentOwner = Boolean(
    lead.corretorId
      && (lead.assignmentSource === "automatic_offer" || lead.corretorId === excludeBrokerId),
  );
  if (lead.corretorId && !canRotateCurrentOwner) {
    return { status: "conflict", leadId, reason: "Lead já possui corretor confirmado." };
  }
  const brokerToExclude = excludeBrokerId ?? (lead.assignmentSource === "automatic_offer" ? lead.corretorId : null);
  if (lead.qualificationState === "IN_PROGRESS" || lead.qualificationStatus === "qualifying") {
    return { status: "queued", leadId, reason: "O lead está em processo de qualificação por IA e aguarda a finalização ou tempo limite para ser distribuído." };
  }
  const [queue] = lead.queueId ? await db.select({ branchId: schema.leadQueues.branchId, strategy: schema.leadQueues.assignmentStrategy, mode: schema.leadQueues.assignmentMode, capacityEnabled: schema.leadQueues.capacityEnabled, capacity: schema.leadQueues.capacityPerBroker }).from(schema.leadQueues).where(and(eq(schema.leadQueues.id, lead.queueId), eq(schema.leadQueues.tenantId, context.tenantId), eq(schema.leadQueues.status, "active"))).limit(1) : [];
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
  if (queue?.branchId && intelligentPolicy.value.excludedBranchIds.includes(queue.branchId)) {
    return { status: "queued", leadId, reason: "A política de distribuição está pausada para esta unidade." };
  }
  const configuredBranchIds = resolveQueueCandidateBranchIds({ queueBranchId: queue?.branchId ?? null, allowedBranchIds: (intelligentPolicy.value.allowedBranchIds ?? []).filter((branchId) => !intelligentPolicy.value.excludedBranchIds.includes(branchId)), leadBranchId: lead.branchId });
  const requestedBranchIds = context.role === "manager" && context.branchId
    ? configuredBranchIds.filter((branchId) => branchId === context.branchId)
    : configuredBranchIds;
  if (!requestedBranchIds.length) {
    if (context.role === "manager" && context.branchId) {
      requestedBranchIds.push(context.branchId);
    }
  }
  if (!requestedBranchIds.length) {
    const tenantWideBranches = await db
      .select({ id: schema.branches.id, createdAt: schema.branches.createdAt })
      .from(schema.branches)
      .where(and(
        eq(schema.branches.tenantId, context.tenantId),
        eq(schema.branches.status, "active"),
        eq(schema.branches.acceptingLeads, true),
        eq(schema.branches.autoDistribute, true),
        eq(schema.branches.isDistributionHub, false),
      ));
    if (!tenantWideBranches.length) return { status: "queued", leadId, reason: "A fila geral não possui unidades elegíveis configuradas." };
    const branchLoads = await db
      .select({ branchId: schema.leads.branchId, total: count(schema.leads.id) })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        inArray(schema.leads.branchId, tenantWideBranches.map((branch) => branch.id)),
        inArray(schema.leads.status, activeCommercialStatuses),
      ))
      .groupBy(schema.leads.branchId);
    const loadMap = new Map(branchLoads.map((row) => [row.branchId, Number(row.total)]));
    const selectedBranch = selectDistributionBranch(tenantWideBranches.map((branch) => ({ ...branch, activeLeads: loadMap.get(branch.id) ?? 0 })));
    if (!selectedBranch) return { status: "queued", leadId, reason: "A fila geral não possui unidades elegíveis configuradas." };
    const routedAt = new Date();
    await db.transaction(async (tx) => {
      await tx.update(schema.leads).set({ branchId: selectedBranch.id, unitAssignedAt: routedAt, distributionUpdatedAt: routedAt })
        .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.branchId)));
      await tx.insert(schema.leadDistributionEvents).values({
        id: randomUUID(),
        tenantId: context.tenantId,
        leadId,
        fromBranchId: null,
        toBranchId: selectedBranch.id,
        fromQueueId: lead.queueId,
        toQueueId: lead.queueId,
        action: "auto_routed_to_unit",
        source: "automatic",
        strategy: "capacity",
        reason: "Unidade automática com menor carga ativa.",
        actorId: context.userId,
        metadata: { activeLeads: selectedBranch.activeLeads },
        createdAt: routedAt,
      });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_distribution", entidadeId: leadId, acao: "lead.auto_routed_to_unit" });
    });
    lead.branchId = selectedBranch.id;
    requestedBranchIds.push(selectedBranch.id);
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
    const rosterResults = await Promise.all(branchIds.map(async (branchId) => [branchId, await getRosterBrokerIds(context.tenantId, branchId, new Date(), lead.webhookCredentialId)] as const));
    const rosterByBranch = new Map(rosterResults);
    const brokers = allBrokers.filter((broker) => {
      const rosterBrokerIds = broker.branchId ? rosterByBranch.get(broker.branchId) : null;
      return (!rosterBrokerIds || rosterBrokerIds.has(broker.id)) && broker.id !== brokerToExclude && !intelligentPolicy.value.excludedBrokerIds.includes(broker.id) && (!allowedBrokerSet || allowedBrokerSet.has(broker.id));
    });
    return { brokers, rosterByBranch };
  };

  let { brokers, rosterByBranch } = await loadEligibleBrokers(targetBranchIds);
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
        fallbackUnitUsed = true;
      }
    }
  }
  if (!brokers.length) {
    return { status: "queued", leadId, reason: "Nenhum corretor elegível nesta unidade." };
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
    db.select({ brokerId: schema.leads.corretorId, total: count(schema.leads.id) }).from(schema.leads).where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.corretorId, ids), inArray(schema.leads.status, activeCommercialStatuses))).groupBy(schema.leads.corretorId),
    db.select({ brokerId: schema.leads.corretorId, status: schema.leads.status, assignedAt: schema.leads.assignedAt, serviceStartedAt: schema.leads.serviceStartedAt, firstContactAt: schema.leads.firstContactAt }).from(schema.leads).where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.corretorId, ids))),
    db.select({ brokerId: schema.leadAssignmentAttempts.brokerId, firstContactAt: schema.leadAssignmentAttempts.firstContactAt, feedbackDueAt: schema.leadAssignmentAttempts.feedbackDueAt }).from(schema.leadAssignmentAttempts).where(and(eq(schema.leadAssignmentAttempts.tenantId, context.tenantId), inArray(schema.leadAssignmentAttempts.brokerId, ids))),
  ]);
  const loadMap = new Map(loads.map((item) => [item.brokerId, Number(item.total)]));
  const candidates = remainingBrokers.map((broker) => {
    const history = brokerLeadHistory.filter((item) => item.brokerId === broker.id);
    const attempts = slaAttempts.filter((item) => item.brokerId === broker.id);
    const conversionRate = history.length ? history.filter((item) => item.status === "converted").length / history.length : 0;
    const slaRate = attempts.length ? attempts.filter((item) => item.firstContactAt && item.firstContactAt <= item.feedbackDueAt).length / attempts.length : 0;
    const idleSince = history.reduce<Date | null>((newest, item) => !item.assignedAt ? newest : (!newest || item.assignedAt > newest ? item.assignedAt : newest), null);
    const unstartedLeads = history.filter((item) => item.status === "distributed" || item.status === "new" || (!item.serviceStartedAt && !item.firstContactAt)).length;
    const candidate = { id: broker.id, createdAt: broker.createdAt, activeLeads: loadMap.get(broker.id) ?? 0, unstartedLeads, lastAssignedAt: idleSince, capacity: queue?.capacityEnabled ? queue.capacity ?? null : null, onDuty: Boolean(broker.branchId && rosterByBranch.get(broker.branchId)?.has(broker.id)), conversionRate, slaRate, manualPriority: 0, idleSince, rankingScore: 0 };
    return { ...candidate, rankingScore: calculateBrokerRankingScore(candidate, intelligentPolicy.value) };
  });
  const decision = resolveDistributionCandidate(candidates, intelligentPolicy.value, queue?.strategy === "round_robin" ? "round_robin" : "capacity");
  // Capacity is a preference, not a reason to strand the lead. When every
  // eligible broker reached the configured target, keep the same fair ranking
  // and select its least-loaded first candidate.
  const chosen = decision.selected ?? decision.overflowSelected;
  if (!chosen) {
    return { status: "queued", leadId, reason: "Nenhum corretor elegível nesta unidade." };
  }
  const chosenBranchId = remainingBrokers.find((broker) => broker.id === chosen.id)?.branchId ?? lead.branchId;
  if (!chosenBranchId) return { status: "queued", leadId, reason: "A unidade do corretor selecionado não foi encontrada." };

  const offer = await createLeadOffersForBrokers({
    tenantId: context.tenantId,
    leadId,
    brokerIds: [chosen.id],
    requestedBy: context.userId,
    expectedCurrentBrokerId: lead.corretorId,
    targetBranchId: chosenBranchId,
    cycleStartedAt: lead.distributionUpdatedAt,
  });
  if (!offer.createdOffers.length) {
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
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)))
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
