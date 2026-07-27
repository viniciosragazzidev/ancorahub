import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, count, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { AuthorizationError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/types";
import { chooseBroker } from "./domain";
import type { AssignmentSource, AssignmentStrategy, LeadAssignmentResult, LeadRoutingResult } from "./types";
import { notifyNewLead } from "@/features/notifications/send-push-helper";

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
  if (!queue) throw new Error("A unidade não possui uma fila ativa.");
  void actorId;
  return queue.id;
}

export async function routeLeadToBranch(context: TenantContext, leadId: string, branchId: string, reason = "Distribuição manual para unidade"): Promise<LeadRoutingResult> {
  if (!canManage(context)) throw new AuthorizationError("Apenas Gestores e Diretores podem distribuir leads.");
  assertBranchScope(context, branchId);
  const db = getDatabase();
  const [branch] = await db.select({ id: schema.branches.id, acceptingLeads: schema.branches.acceptingLeads, status: schema.branches.status }).from(schema.branches).where(and(eq(schema.branches.id, branchId), eq(schema.branches.tenantId, context.tenantId))).limit(1);
  if (!branch || branch.status !== "active" || !branch.acceptingLeads) return { status: "failed", code: "BRANCH_NOT_ACCEPTING_LEADS" };
  const queueId = await ensureDefaultQueue(context.tenantId, branchId, context.userId);
  const [lead] = await db.select({ id: schema.leads.id, branchId: schema.leads.branchId, corretorId: schema.leads.corretorId }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  if (!lead) return { status: "failed", code: "LEAD_NOT_FOUND" };
  const updated = await db.transaction(async (tx) => {
    const result = await tx.update(schema.leads).set({ branchId, queueId, corretorId: null, distributionStatus: "queued", distributionOrigin: context.role === "director" ? "parent" : "unit", unitAssignedAt: new Date(), assignmentSource: context.role === "director" ? "manual_director" : "manual_manager", assignmentStrategy: "manual", distributionUpdatedAt: new Date() }).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.corretorId))).returning({ id: schema.leads.id });
    if (!result.length) return false;
    await tx.insert(schema.leadDistributionEvents).values({ id: randomUUID(), tenantId: context.tenantId, leadId, fromBranchId: lead.branchId, toBranchId: branchId, previousOwnerId: lead.corretorId, toQueueId: queueId, action: "routed_to_unit", source: context.role === "director" ? "manual_director" : "manual_manager", strategy: "manual", reason, actorId: context.userId, createdAt: new Date() });
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_distribution", entidadeId: leadId, acao: "lead.routed_to_unit" });
    return true;
  });
  return updated ? { status: "routed", branchId, queueId, strategy: "manual" } : { status: "conflict", code: "LEAD_ALREADY_ASSIGNED" };
}

export async function assignLeadToBroker(context: TenantContext, leadId: string, brokerId: string, source?: AssignmentSource, reason = "Atribuição manual", excludeBrokerId?: string | null): Promise<LeadAssignmentResult> {
  if (!canManage(context)) throw new AuthorizationError("Apenas Gestores e Diretores podem atribuir leads.");
  const db = getDatabase();
  const [lead] = await db.select({ id: schema.leads.id, nome: schema.leads.nome, branchId: schema.leads.branchId, queueId: schema.leads.queueId, corretorId: schema.leads.corretorId, distributionOrigin: schema.leads.distributionOrigin }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  if (!lead) return { status: "conflict", leadId, reason: "Lead não encontrado." };
  if (!lead.branchId) return { status: "conflict", leadId, reason: "Envie o lead para uma unidade antes de atribuir um corretor." };
  assertBranchScope(context, lead.branchId);
  const [broker] = await db.select({ id: schema.user.id, branchId: schema.tenantMemberships.branchId }).from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id)).where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, brokerId), eq(schema.tenantMemberships.branchId, lead.branchId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.tenantMemberships.availabilityStatus, "available"), eq(schema.user.active, true), eq(schema.user.status, "active"))).limit(1);
  if (!broker) return { status: "conflict", leadId, reason: "O corretor não está elegível nesta unidade." };
  if (excludeBrokerId && brokerId === excludeBrokerId) return { status: "conflict", leadId, reason: "O corretor que perdeu o SLA não pode receber este lead novamente." };
  const [tenantPolicy] = await db.select({ feedbackRequiredEnabled: schema.tenants.feedbackRequiredEnabled, feedbackGraceMinutes: schema.tenants.feedbackGraceMinutes, slaFirstContactMinutes: schema.tenants.slaFirstContactMinutes }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1);
  const assignedAt = new Date();
  const feedbackDueAt = new Date(assignedAt.getTime() + ((Number.parseInt(tenantPolicy?.slaFirstContactMinutes ?? "15", 10) || 15) + (Number.parseInt(tenantPolicy?.feedbackGraceMinutes ?? "5", 10) || 5)) * 60_000);
  const assigned = await db.transaction(async (tx) => {
    const result = await tx.update(schema.leads).set({ corretorId: brokerId, status: "distributed", distributionStatus: "assigned", distributionOrigin: source === "manual_director" ? "parent" : source === "manual_manager" ? "unit" : lead.distributionOrigin ?? (context.role === "director" ? "parent" : "unit"), assignedAt: new Date(), assignmentSource: source ?? (context.role === "director" ? "manual_director" : "manual_manager"), assignmentStrategy: "manual", distributionUpdatedAt: new Date() }).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.corretorId))).returning({ id: schema.leads.id });
    if (!result.length) return false;
    if (tenantPolicy?.feedbackRequiredEnabled !== false) {
      const [attemptCount] = await tx.select({ total: count(schema.leadAssignmentAttempts.id) }).from(schema.leadAssignmentAttempts).where(and(eq(schema.leadAssignmentAttempts.tenantId, context.tenantId), eq(schema.leadAssignmentAttempts.leadId, leadId)));
      await tx.insert(schema.leadAssignmentAttempts).values({ id: randomUUID(), tenantId: context.tenantId, leadId, brokerId, sequence: Number(attemptCount?.total ?? 0) + 1, assignedAt, feedbackDueAt, status: "open", createdAt: assignedAt });
    }
    await tx.insert(schema.leadDistributionEvents).values({ id: randomUUID(), tenantId: context.tenantId, leadId, fromBranchId: lead.branchId, toBranchId: lead.branchId, fromQueueId: lead.queueId, toQueueId: lead.queueId, previousOwnerId: lead.corretorId, newOwnerId: brokerId, action: "assigned", source: source ?? "manual_manager", strategy: "manual", reason, actorId: context.userId, createdAt: new Date() });
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_distribution", entidadeId: leadId, acao: "lead.assigned" });
    return true;
  });
  if (assigned) await notifyNewLead(leadId, context.tenantId, lead.branchId, brokerId, lead.nome).catch(console.error);
  return assigned ? { status: "assigned", leadId, brokerId, strategy: "manual" } : { status: "conflict", leadId, reason: "Este lead já foi atribuído. Atualize a fila." };
}

export async function processQueuedLead(context: TenantContext, leadId: string, excludeBrokerId?: string | null): Promise<LeadAssignmentResult> {
  if (!canManage(context)) throw new AuthorizationError("Você não pode executar a distribuição automática.");
  const db = getDatabase();
  const [lead] = await db.select({ id: schema.leads.id, branchId: schema.leads.branchId, queueId: schema.leads.queueId, webhookCredentialId: schema.leads.webhookCredentialId }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.distributionStatus, "queued"))).limit(1);
  if (!lead || !lead.branchId) return { status: "queued", leadId, reason: "Lead ainda aguarda uma unidade." };
  assertBranchScope(context, lead.branchId);
  const [branch] = await db.select({ autoDistribute: schema.branches.autoDistribute, acceptingLeads: schema.branches.acceptingLeads, status: schema.branches.status }).from(schema.branches).where(and(eq(schema.branches.id, lead.branchId), eq(schema.branches.tenantId, context.tenantId))).limit(1);
  if (!branch || branch.status !== "active" || !branch.acceptingLeads) return { status: "queued", leadId, reason: "A unidade está pausada para recebimento." };
  if (!branch.autoDistribute) return { status: "queued", leadId, reason: "A distribuição automática está desativada nesta unidade." };
  const [queue] = lead.queueId ? await db.select({ strategy: schema.leadQueues.assignmentStrategy, mode: schema.leadQueues.assignmentMode, capacityEnabled: schema.leadQueues.capacityEnabled, capacity: schema.leadQueues.capacityPerBroker }).from(schema.leadQueues).where(and(eq(schema.leadQueues.id, lead.queueId), eq(schema.leadQueues.tenantId, context.tenantId), eq(schema.leadQueues.status, "active"))).limit(1) : [];
  if (queue?.mode === "manual") return { status: "queued", leadId, reason: "A fila está em modo manual." };
  const allBrokers = await db.select({ id: schema.user.id, createdAt: schema.user.createdAt }).from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id)).where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.branchId, lead.branchId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.tenantMemberships.availabilityStatus, "available"), eq(schema.user.active, true), eq(schema.user.status, "active"))).orderBy(asc(schema.user.createdAt));
  const rosterBrokerIds = await getRosterBrokerIds(context.tenantId, lead.branchId, new Date(), lead.webhookCredentialId);
  const brokers = (rosterBrokerIds ? allBrokers.filter((broker) => rosterBrokerIds.has(broker.id)) : allBrokers).filter((broker) => broker.id !== excludeBrokerId);
  const ids = brokers.map((broker) => broker.id);
  if (!ids.length) return { status: "queued", leadId, reason: "Nenhum corretor elegível nesta unidade." };
  const loads = await db.select({ brokerId: schema.leads.corretorId, total: count(schema.leads.id) }).from(schema.leads).where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.corretorId, ids), inArray(schema.leads.status, activeCommercialStatuses))).groupBy(schema.leads.corretorId);
  const loadMap = new Map(loads.map((item) => [item.brokerId, Number(item.total)]));
  const chosen = chooseBroker(brokers.map((broker) => ({ id: broker.id, createdAt: broker.createdAt, activeLeads: loadMap.get(broker.id) ?? 0, capacity: queue?.capacityEnabled ? queue.capacity ?? null : null })), queue?.strategy === "round_robin" ? "round_robin" : "capacity");
  if (!chosen) return { status: "queued", leadId, reason: "Todos os corretores elegíveis atingiram a capacidade." };
  return assignLeadToBroker(context, leadId, chosen.id, "automatic", "Distribuição automática da fila", excludeBrokerId);
}
