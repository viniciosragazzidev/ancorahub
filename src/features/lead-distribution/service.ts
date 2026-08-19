import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, count, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { AuthorizationError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/types";
import { calculateBrokerRankingScore, defaultIntelligentDistributionPolicy, rankBrokers, resolveDistributionCandidate, resolveQueueCandidateBranchIds, type IntelligentDistributionPolicy } from "./domain";
import type { AssignmentSource, AssignmentStrategy, LeadAssignmentResult, LeadRoutingResult } from "./types";
import { notifyNewLead } from "@/features/notifications/send-push-helper";
import { enqueueLeadEffectTx } from "@/features/leads/webhooks/services/lead-effect-outbox";

const activeCommercialStatuses = ["distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;

function canManage(context: TenantContext) {
  return context.role === "director" || context.role === "manager";
}

function assertBranchScope(context: TenantContext, branchId: string) {
  if (context.role === "manager" && context.branchId !== branchId) throw new AuthorizationError("Você só pode operar leads da sua unidade.");
}

function getLocalDutyParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const weekday = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.find((part) => part.type === "weekday")?.value as "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat"] ?? 0;
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return { weekday, time: `${hour === "24" ? "00" : hour}:${minute}` };
}

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

  return assignments.length ? new Set(assignments.map((a) => a.brokerId)) : null;
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
  const [row] = await getDatabase().select({ enabled: schema.leadDistributionPolicies.enabled, policy: schema.leadDistributionPolicies.policy })
    .from(schema.leadDistributionPolicies)
    .where(and(eq(schema.leadDistributionPolicies.tenantId, tenantId), queueId ? eq(schema.leadDistributionPolicies.queueId, queueId) : undefined, profileKey ? eq(schema.leadDistributionPolicies.profileKey, profileKey) : undefined))
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
  const [branch] = await db.select({ id: schema.branches.id, acceptingLeads: schema.branches.acceptingLeads, status: schema.branches.status }).from(schema.branches).where(and(eq(schema.branches.id, branchId), eq(schema.branches.tenantId, context.tenantId))).limit(1);
  if (!branch || branch.status !== "active" || !branch.acceptingLeads) return { status: "failed", code: "BRANCH_NOT_ACCEPTING_LEADS" };
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
    .select({ id: schema.branches.id, acceptingLeads: schema.branches.acceptingLeads, status: schema.branches.status })
    .from(schema.branches)

    .where(and(eq(schema.branches.id, branchId), eq(schema.branches.tenantId, context.tenantId)))
    .limit(1);
  if (!branch || branch.status !== "active" || !branch.acceptingLeads)
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
  const notificationWarnings: string[] = [];
  const assignmentNotificationKey = `lead-assigned:${randomUUID()}`;

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
      id: randomUUID(),
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

    return true;
  });

  if (assigned) {
    const notifyResult = await notifyNewLead(leadId, context.tenantId, branchId, brokerId, lead.nome, assignmentNotificationKey).catch(() => undefined);
    if (notifyResult?.notificationError) notificationWarnings.push(notifyResult.notificationError);
  }

  return assigned
    ? { status: "assigned", leadId, brokerId, strategy: "manual", notificationWarnings: notificationWarnings.length ? notificationWarnings : undefined }
    : { status: "conflict", leadId, reason: "Este lead já foi atribuído. Atualize a fila." };
}

export async function assignLeadToBroker(context: TenantContext, leadId: string, brokerId: string, source?: AssignmentSource, reason = "Atribuição manual", excludeBrokerId?: string | null, targetBranchId?: string): Promise<LeadAssignmentResult> {
  if (!canManage(context)) throw new AuthorizationError("Apenas Gestores e Diretores podem atribuir leads.");
  const db = getDatabase();
  const [lead] = await db.select({ id: schema.leads.id, nome: schema.leads.nome, branchId: schema.leads.branchId, queueId: schema.leads.queueId, corretorId: schema.leads.corretorId, distributionOrigin: schema.leads.distributionOrigin }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  if (!lead) return { status: "conflict", leadId, reason: "Lead não encontrado." };
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
    const result = await tx.update(schema.leads).set({ branchId: assignmentBranchId, corretorId: brokerId, status: "distributed", distributionStatus: "assigned", distributionOrigin: source === "manual_director" ? "parent" : source === "manual_manager" ? "unit" : lead.distributionOrigin ?? (context.role === "director" ? "parent" : "unit"), assignedAt, assignmentSource: source ?? (context.role === "director" ? "manual_director" : "manual_manager"), assignmentStrategy: "manual", distributionUpdatedAt: assignedAt }).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.corretorId))).returning({ id: schema.leads.id });
    if (!result.length) return false;
    if (tenantPolicy?.feedbackRequiredEnabled !== false) {
      const [attemptCount] = await tx.select({ total: count(schema.leadAssignmentAttempts.id) }).from(schema.leadAssignmentAttempts).where(and(eq(schema.leadAssignmentAttempts.tenantId, context.tenantId), eq(schema.leadAssignmentAttempts.leadId, leadId)));
      await tx.insert(schema.leadAssignmentAttempts).values({ id: randomUUID(), tenantId: context.tenantId, leadId, brokerId, sequence: Number(attemptCount?.total ?? 0) + 1, assignedAt, feedbackDueAt, status: "open", createdAt: assignedAt });
    }
    await tx.insert(schema.leadDistributionEvents).values({ id: assignmentEventId, tenantId: context.tenantId, leadId, fromBranchId: lead.branchId, toBranchId: assignmentBranchId, fromQueueId: lead.queueId, toQueueId: lead.queueId, previousOwnerId: lead.corretorId, newOwnerId: brokerId, action: "assigned", source: source ?? "manual_manager", strategy: "manual", reason, actorId: context.userId, createdAt: assignedAt });
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_distribution", entidadeId: leadId, acao: "lead.assigned" });
    if (source === "automatic") {
      await enqueueLeadEffectTx(tx, {
        tenantId: context.tenantId,
        leadId,
        type: "NOTIFY_LEAD_ASSIGNED",
        idempotencyKey: `lead-assigned:${assignmentEventId}`,
        payload: { branchId: lead.branchId, brokerId, leadName: lead.nome },
      });
    }
    return true;
  });
  const notificationWarnings: string[] = [];
  if (assigned && source !== "automatic") {
    const notifyResult = await notifyNewLead(leadId, context.tenantId, assignmentBranchId, brokerId, lead.nome, `lead-assigned:${assignmentEventId}`).catch(() => undefined);
    if (notifyResult?.notificationError) notificationWarnings.push(notifyResult.notificationError);
  }
  return assigned
    ? { status: "assigned", leadId, brokerId, strategy: "manual", notificationWarnings: notificationWarnings.length ? notificationWarnings : undefined }
    : { status: "conflict", leadId, reason: "Este lead já foi atribuído. Atualize a fila." };
}

export async function processQueuedLead(context: TenantContext, leadId: string, excludeBrokerId?: string | null): Promise<LeadAssignmentResult> {
  if (!canManage(context)) throw new AuthorizationError("Você não pode executar a distribuição automática.");
  const db = getDatabase();
  const [lead] = await db.select({
    id: schema.leads.id,
    branchId: schema.leads.branchId,
    queueId: schema.leads.queueId,
    webhookCredentialId: schema.leads.webhookCredentialId,
    qualificationProfileKey: schema.leads.qualificationProfileKey,
    qualificationState: schema.leads.qualificationState,
    qualificationStatus: schema.leads.qualificationStatus,
  }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.distributionStatus, "queued"))).limit(1);
  if (!lead) return { status: "queued", leadId, reason: "Lead não encontrado." };
  if (lead.qualificationState === "IN_PROGRESS" || lead.qualificationStatus === "qualifying") {
    return { status: "queued", leadId, reason: "O lead está em processo de qualificação por IA e aguarda a finalização ou tempo limite para ser distribuído." };
  }
  const [queue] = lead.queueId ? await db.select({ branchId: schema.leadQueues.branchId, strategy: schema.leadQueues.assignmentStrategy, mode: schema.leadQueues.assignmentMode, capacityEnabled: schema.leadQueues.capacityEnabled, capacity: schema.leadQueues.capacityPerBroker }).from(schema.leadQueues).where(and(eq(schema.leadQueues.id, lead.queueId), eq(schema.leadQueues.tenantId, context.tenantId), eq(schema.leadQueues.status, "active"))).limit(1) : [];
  if (lead.queueId && !queue) return { status: "queued", leadId, reason: "A fila configurada não está ativa." };
  if (queue?.mode === "manual") return { status: "queued", leadId, reason: "A fila está em modo manual." };
  if (queue?.branchId) {
    if (lead.branchId && queue.branchId !== lead.branchId) return { status: "queued", leadId, reason: "A fila configurada pertence a outra unidade." };
    assertBranchScope(context, queue.branchId);
  }
  const intelligentPolicy = await loadDistributionPolicy(context.tenantId, lead.queueId, lead.qualificationProfileKey);
  if (!intelligentPolicy.enabled) return { status: "queued", leadId, reason: "A política de distribuição está pausada para esta fila." };
  if (queue?.branchId && intelligentPolicy.value.excludedBranchIds.includes(queue.branchId)) return { status: "queued", leadId, reason: "A política de distribuição está pausada para esta unidade." };
  const configuredBranchIds = resolveQueueCandidateBranchIds({ queueBranchId: queue?.branchId ?? null, allowedBranchIds: (intelligentPolicy.value.allowedBranchIds ?? []).filter((branchId) => !intelligentPolicy.value.excludedBranchIds.includes(branchId)) });
  const requestedBranchIds = context.role === "manager" && context.branchId
    ? configuredBranchIds.filter((branchId) => branchId === context.branchId)
    : configuredBranchIds;
  if (!requestedBranchIds.length) return { status: "queued", leadId, reason: "A fila geral não possui unidades elegíveis configuradas." };
  const activeBranches = await db.select({ id: schema.branches.id }).from(schema.branches).where(and(eq(schema.branches.tenantId, context.tenantId), inArray(schema.branches.id, requestedBranchIds), eq(schema.branches.status, "active"), eq(schema.branches.acceptingLeads, true), eq(schema.branches.autoDistribute, true)));
  const targetBranchIds = activeBranches.map((branch) => branch.id);
  if (!targetBranchIds.length) return { status: "queued", leadId, reason: "Nenhuma unidade elegível está ativa para esta fila." };
  const allBrokers = await db.select({ id: schema.user.id, branchId: schema.tenantMemberships.branchId, createdAt: schema.user.createdAt }).from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id)).where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), inArray(schema.tenantMemberships.branchId, targetBranchIds), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.jobTitle, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.tenantMemberships.availabilityStatus, "available"), eq(schema.user.active, true), eq(schema.user.status, "active"))).orderBy(asc(schema.user.createdAt));
  const rosterResults = await Promise.all(targetBranchIds.map(async (branchId) => [branchId, await getRosterBrokerIds(context.tenantId, branchId, new Date(), lead.webhookCredentialId)] as const));
  const rosterByBranch = new Map(rosterResults);
  const allowedBrokerSet = intelligentPolicy.value.allowedBrokerIds?.length ? new Set(intelligentPolicy.value.allowedBrokerIds) : null;
  const brokers = allBrokers.filter((broker) => {
    const rosterBrokerIds = broker.branchId ? rosterByBranch.get(broker.branchId) : null;
    return (!rosterBrokerIds || rosterBrokerIds.has(broker.id)) && broker.id !== excludeBrokerId && !intelligentPolicy.value.excludedBrokerIds.includes(broker.id) && (!allowedBrokerSet || allowedBrokerSet.has(broker.id));
  });
  const ids = brokers.map((broker) => broker.id);
  if (!ids.length) return { status: "queued", leadId, reason: "Nenhum corretor elegível nesta unidade." };
  const [loads, brokerLeadHistory, slaAttempts] = await Promise.all([
    db.select({ brokerId: schema.leads.corretorId, total: count(schema.leads.id) }).from(schema.leads).where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.corretorId, ids), inArray(schema.leads.status, activeCommercialStatuses))).groupBy(schema.leads.corretorId),
    db.select({ brokerId: schema.leads.corretorId, status: schema.leads.status, assignedAt: schema.leads.assignedAt }).from(schema.leads).where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.corretorId, ids))),
    db.select({ brokerId: schema.leadAssignmentAttempts.brokerId, firstContactAt: schema.leadAssignmentAttempts.firstContactAt, feedbackDueAt: schema.leadAssignmentAttempts.feedbackDueAt }).from(schema.leadAssignmentAttempts).where(and(eq(schema.leadAssignmentAttempts.tenantId, context.tenantId), inArray(schema.leadAssignmentAttempts.brokerId, ids))),
  ]);
  const loadMap = new Map(loads.map((item) => [item.brokerId, Number(item.total)]));
  const ranked = rankBrokers(brokers.map((broker) => {
    const history = brokerLeadHistory.filter((item) => item.brokerId === broker.id);
    const attempts = slaAttempts.filter((item) => item.brokerId === broker.id);
    const conversionRate = history.length ? history.filter((item) => item.status === "converted").length / history.length : 0;
    const slaRate = attempts.length ? attempts.filter((item) => item.firstContactAt && item.firstContactAt <= item.feedbackDueAt).length / attempts.length : 0;
    const idleSince = history.reduce<Date | null>((oldest, item) => !item.assignedAt || (oldest && oldest < item.assignedAt) ? oldest : item.assignedAt, null);
    const candidate = { id: broker.id, createdAt: broker.createdAt, activeLeads: loadMap.get(broker.id) ?? 0, capacity: queue?.capacityEnabled ? queue.capacity ?? null : null, onDuty: Boolean(broker.branchId && rosterByBranch.get(broker.branchId)?.has(broker.id)), conversionRate, slaRate, manualPriority: 0, idleSince, rankingScore: 0 };
    return { ...candidate, rankingScore: calculateBrokerRankingScore(candidate, intelligentPolicy.value) };
  }), intelligentPolicy.value);
  const decision = resolveDistributionCandidate(ranked, intelligentPolicy.value, queue?.strategy === "round_robin" ? "round_robin" : "capacity");
  const chosen = decision.selected;
  if (!chosen) return { status: "queued", leadId, reason: "Todos os corretores elegíveis atingiram a capacidade." };
  const chosenBranchId = brokers.find((broker) => broker.id === chosen.id)?.branchId ?? lead.branchId;
  if (!chosenBranchId) return { status: "queued", leadId, reason: "A unidade do corretor selecionado não foi encontrada." };
  return assignLeadToBroker(context, leadId, chosen.id, "automatic", "Distribuição automática da fila", excludeBrokerId, chosenBranchId);
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

  const { resolveQualificationDestination, getBrokerEligibilityProfiles } = await import("@/features/ai-qualification/destination-routing-service");

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

  // Buscar unidade padrão se o lead não possuir branchId
  let targetBranchId = lead.branchId;
  if (!targetBranchId) {
    const [defaultBranch] = await db
      .select({ id: schema.branches.id })
      .from(schema.branches)
      .where(and(eq(schema.branches.tenantId, input.tenantId), eq(schema.branches.status, "active")))
      .limit(1);
    targetBranchId = defaultBranch?.id ?? null;
  }

  if (!targetBranchId) {
    return { distributed: false, destination, reason: "no_active_branch_found" };
  }

  const [distributionDirector] = await db.select({ id: schema.tenantMemberships.userId }).from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.tenantId, input.tenantId), eq(schema.tenantMemberships.role, "director"), eq(schema.tenantMemberships.status, "active")))
    .orderBy(asc(schema.tenantMemberships.createdAt)).limit(1);
  const distributionActorId = input.actorUserId ?? distributionDirector?.id;
  if (!distributionActorId) return { distributed: false, destination, reason: "no_distribution_actor" };
  const distributionContext: TenantContext = { tenantId: input.tenantId, userId: distributionActorId, role: "director", jobTitle: "director", branchId: targetBranchId };
  const routedQualifiedLead = lead.queueId
    ? { status: "routed" as const }
    : await routeLeadToBranch(distributionContext, input.leadId, targetBranchId, `Qualification completed (${classification.toUpperCase()})`);
  if (routedQualifiedLead.status !== "routed") return { distributed: false, destination, reason: `routing_${routedQualifiedLead.status}` };
  const routedAssignment = await processQueuedLead(distributionContext, input.leadId);
  if (routedAssignment.status === "queued") {
    // A qualified lead is never discarded because the roster is empty. Keep
    // its qualification and queue position until a broker becomes eligible.
    await db.update(schema.leads).set({
      corretorId: null,
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
    distributed: routedAssignment.status === "assigned",
    brokerId: routedAssignment.status === "assigned" ? routedAssignment.brokerId : null,
    destination,
    assignedResult: routedAssignment,
  };

  /*
   * Legacy direct-assignment path retained temporarily as migration reference.
   * Qualification now exits through routeLeadToBranch + processQueuedLead above,
   * so its capacity, roster, policy, audit and fallback rules remain identical
   * to every other distribution source.
   */

  // Buscar corretores elegíveis
  const allBrokers = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      createdAt: schema.user.createdAt,
    })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, input.tenantId),
        eq(schema.tenantMemberships.branchId, targetBranchId!),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
        eq(schema.tenantMemberships.availabilityStatus, "available"),
        eq(schema.user.active, true),
        eq(schema.user.status, "active")
      )
    );

  const eligibilityProfiles = await getBrokerEligibilityProfiles(input.tenantId);

  const eligibleBrokers = allBrokers.filter((broker) => {
    const profile = eligibilityProfiles.find((p) => p.userId === broker.id);
    if (!profile) return true; // sem perfil específico, usa regras globais
    if (!profile.active || profile.paused) return false;
    const allowedTypes = (profile.allowedLeadTypes ?? []) as string[];
    if (allowedTypes.length > 0 && !allowedTypes.includes(classification)) return false;
    return true;
  });

  if (eligibleBrokers.length === 0) {
    // Manter na fila sem perder a qualificação
    await db.update(schema.leads).set({
      branchId: targetBranchId,
      distributionStatus: "queued",
      updatedAt: new Date(),
    }).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)));

    console.warn("[distribute-qualified] Nenhum corretor elegível disponível. Lead mantido na fila de espera.", {
      tenantId: input.tenantId,
      leadId: input.leadId,
      classification,
    });

    return { distributed: false, destination, reason: "no_eligible_broker_available" };
  }

  // Escolher corretor (round-robin / menor carga)
  const chosenBroker = eligibleBrokers[0];

  const adminContext = {
    tenantId: input.tenantId,
    userId: input.actorUserId ?? chosenBroker.id,
    role: "director" as const,
    jobTitle: "director",
    branchId: targetBranchId,
  };

  const assigned = await assignLeadToBroker(
    adminContext,
    input.leadId,
    chosenBroker.id,
    "automatic",
    `Distribuição automática por qualificação (${classification.toUpperCase()})`
  );

  return {
    distributed: assigned.status === "assigned",
    brokerId: chosenBroker.id,
    destination,
    assignedResult: assigned,
  };
}
