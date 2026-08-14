import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import type { TenantContext } from "@/shared/auth/types";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import { calculateBrokerRankingScore, defaultIntelligentDistributionPolicy, resolveDistributionCandidate, type IntelligentDistributionPolicy, type RankedBroker } from "./domain";

const queueInput = z.object({
  id: z.string().uuid().optional(),
  branchId: z.string().uuid().nullable().optional(),
  exclusiveDutyScheduleId: z.string().uuid().nullable().optional(),
  allowedBranchIds: z.array(z.string().uuid()).default([]),
  allowedBrokerIds: z.array(z.string().uuid()).default([]),
  name: z.string().trim().min(3).max(60),
  assignmentMode: z.enum(["automatic", "manual"]),
  assignmentStrategy: z.enum(["round_robin", "capacity"]),
  capacityEnabled: z.boolean(),
  capacityPerBroker: z.number().int().min(1).max(200).nullable(),
  status: z.enum(["active", "inactive"]),
});

const simulationInput = z.object({
  branchId: z.string().uuid().nullable().optional(),
  queueId: z.string().uuid().optional(),
  temperature: z.enum(["hot", "warm", "cold"]).default("warm"),
  score: z.number().int().min(0).max(100).default(50),
});

const campaignQueueRouteInput = z.object({
  campaignId: z.string().trim().min(1).max(100),
  queueId: z.string().uuid().nullable(),
  enabled: z.boolean().default(true),
}).superRefine((input, context) => {
  if (input.enabled && !input.queueId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["queueId"], message: "Selecione a fila que receberá os leads desta campanha." });
  }
});

const adQueueRouteInput = z.object({
  adId: z.string().trim().min(1).max(100),
  queueId: z.string().uuid().nullable(),
  enabled: z.boolean().default(true),
}).superRefine((input, context) => {
  if (input.enabled && !input.queueId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["queueId"], message: "Selecione a fila que receberá os leads deste anúncio." });
  }
});

function assertManager(context: TenantContext, branchId?: string | null) {
  if (context.role !== "director" && context.role !== "manager") throw new AuthorizationError("Sem permissão para administrar filas.");
  if (context.role === "manager" && branchId && context.branchId !== branchId) throw new AuthorizationError("Você só pode administrar filas da sua unidade.");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function readPolicy(value: unknown): IntelligentDistributionPolicy {
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

export async function saveDistributionQueue(context: TenantContext, rawInput: unknown) {
  const input = queueInput.parse(rawInput);
  if (input.branchId) {
    assertManager(context, input.branchId);
  }
  const db = getDatabase();
  if (input.branchId) {
    const [branch] = await db.select({ id: schema.branches.id }).from(schema.branches)
      .where(and(eq(schema.branches.id, input.branchId), eq(schema.branches.tenantId, context.tenantId))).limit(1);
    if (!branch) throw new AuthorizationError("Unidade não encontrada no seu escopo.");
  }
  if (input.exclusiveDutyScheduleId) {
    const [schedule] = await db
      .select({ id: schema.unitDutySchedules.id, branchId: schema.unitDutySchedules.branchId })
      .from(schema.unitDutySchedules)
      .where(
        and(
          eq(schema.unitDutySchedules.id, input.exclusiveDutyScheduleId),
          eq(schema.unitDutySchedules.tenantId, context.tenantId),
        ),
      )
      .limit(1);

    if (!schedule) throw new AuthorizationError("Plantão não encontrado no escopo desta corretora.");
    if (input.branchId && schedule.branchId !== input.branchId) {
      throw new AuthorizationError("O plantão selecionado precisa pertencer à mesma unidade da fila.");
    }
    assertManager(context, schedule.branchId);
  }

  const now = new Date();
  const values = {
    branchId: input.branchId ?? null,
    exclusiveDutyScheduleId: input.exclusiveDutyScheduleId ?? null,
    name: input.name,
    assignmentMode: input.assignmentMode,
    assignmentStrategy: input.assignmentStrategy,
    capacityEnabled: input.capacityEnabled,
    capacityPerBroker: input.capacityEnabled ? input.capacityPerBroker : null,
    status: input.status,
    updatedAt: now,
  };

  let queueId = input.id;
  let created = false;

  if (queueId) {
    const [queue] = await db.select({ id: schema.leadQueues.id, branchId: schema.leadQueues.branchId }).from(schema.leadQueues)
      .where(and(eq(schema.leadQueues.id, queueId), eq(schema.leadQueues.tenantId, context.tenantId))).limit(1);
    if (!queue) throw new AuthorizationError("Fila não encontrada no seu escopo.");
    await db.update(schema.leadQueues).set(values).where(eq(schema.leadQueues.id, queue.id));
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_queue", entidadeId: queue.id, acao: "queue.updated" });
  } else {
    queueId = randomUUID();
    created = true;
    const slugBase = slugify(input.name) || "fila";
    await db.insert(schema.leadQueues).values({ id: queueId, tenantId: context.tenantId, slug: `${slugBase}-${queueId.slice(0, 6)}`, isDefault: false, createdAt: now, ...values });
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_queue", entidadeId: queueId, acao: "queue.created" });
  }

  // Update or insert queue distribution policy with allowedBranchIds & allowedBrokerIds
  const [existingPolicy] = await db.select({ id: schema.leadDistributionPolicies.id, policy: schema.leadDistributionPolicies.policy })
    .from(schema.leadDistributionPolicies)
    .where(and(eq(schema.leadDistributionPolicies.tenantId, context.tenantId), eq(schema.leadDistributionPolicies.queueId, queueId)))
    .limit(1);

  const currentPolicy = readPolicy(existingPolicy?.policy);
  const updatedPolicy: IntelligentDistributionPolicy = {
    ...currentPolicy,
    allowedBranchIds: input.allowedBranchIds,
    allowedBrokerIds: input.allowedBrokerIds,
  };

  if (existingPolicy) {
    await db.update(schema.leadDistributionPolicies)
      .set({ policy: updatedPolicy, updatedBy: context.userId, updatedAt: now })
      .where(eq(schema.leadDistributionPolicies.id, existingPolicy.id));
  } else {
    await db.insert(schema.leadDistributionPolicies).values({
      id: randomUUID(),
      tenantId: context.tenantId,
      queueId,
      enabled: true,
      policy: updatedPolicy,
      updatedBy: context.userId,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { id: queueId, created };
}

export async function saveMetaCampaignQueueRoute(context: TenantContext, rawInput: unknown) {
  const input = campaignQueueRouteInput.parse(rawInput);
  const db = getDatabase();
  const [[campaign], queueResult] = await Promise.all([
    db.select({ campaignId: schema.metaCampaigns.campaignId }).from(schema.metaCampaigns)
      .where(and(eq(schema.metaCampaigns.tenantId, context.tenantId), eq(schema.metaCampaigns.campaignId, input.campaignId))).limit(1),
    input.queueId
      ? db.select({ id: schema.leadQueues.id, branchId: schema.leadQueues.branchId, status: schema.leadQueues.status }).from(schema.leadQueues)
        .where(and(eq(schema.leadQueues.tenantId, context.tenantId), eq(schema.leadQueues.id, input.queueId))).limit(1)
      : Promise.resolve([]),
  ]);
  const queue = queueResult[0];
  if (!campaign) throw new AuthorizationError("Campanha Meta não encontrada na sua empresa.");
  if (input.enabled && input.queueId && (!queue || queue.status !== "active")) throw new AuthorizationError("Fila ativa não encontrada na sua empresa.");
  if (input.enabled && queue) assertManager(context, queue.branchId);
  if (!input.enabled && context.role !== "director") throw new AuthorizationError("Apenas o Diretor pode impedir a entrada de uma campanha no CRM.");
  const now = new Date();
  await db.insert(schema.metaCampaignQueueRoutes).values({
    id: randomUUID(), tenantId: context.tenantId, campaignId: campaign.campaignId, queueId: queue?.id ?? null,
    enabled: input.enabled, createdBy: context.userId, createdAt: now, updatedAt: now,
  }).onConflictDoUpdate({
    target: [schema.metaCampaignQueueRoutes.tenantId, schema.metaCampaignQueueRoutes.campaignId],
    set: { queueId: queue?.id ?? null, enabled: input.enabled, updatedAt: now },
  });
  await db.insert(schema.auditLogs).values({
    id: randomUUID(), userId: context.userId, entidade: "meta_campaign_queue_route", entidadeId: campaign.campaignId,
    acao: input.enabled ? "meta_campaign_queue_route.saved" : "meta_campaign_queue_route.paused",
  });
  return { campaignId: campaign.campaignId, queueId: queue?.id ?? null, enabled: input.enabled };
}

export async function saveMetaAdQueueRoute(context: TenantContext, rawInput: unknown) {
  const input = adQueueRouteInput.parse(rawInput);
  const db = getDatabase();
  const [[ad], queueResult] = await Promise.all([
    db.select({ adId: schema.metaAds.adId }).from(schema.metaAds)
      .where(and(eq(schema.metaAds.tenantId, context.tenantId), eq(schema.metaAds.adId, input.adId))).limit(1),
    input.queueId
      ? db.select({ id: schema.leadQueues.id, branchId: schema.leadQueues.branchId, status: schema.leadQueues.status }).from(schema.leadQueues)
        .where(and(eq(schema.leadQueues.tenantId, context.tenantId), eq(schema.leadQueues.id, input.queueId))).limit(1)
      : Promise.resolve([]),
  ]);
  const queue = queueResult[0];
  if (!ad) throw new AuthorizationError("Anúncio Meta não encontrado na sua empresa.");
  if (input.enabled && (!queue || queue.status !== "active")) throw new AuthorizationError("Fila ativa não encontrada na sua empresa.");
  if (input.enabled && queue) assertManager(context, queue.branchId);
  if (!input.enabled && context.role !== "director") throw new AuthorizationError("Apenas o Diretor pode impedir a entrada de um anúncio no CRM.");
  const now = new Date();
  await db.insert(schema.metaAdQueueRoutes).values({
    id: randomUUID(), tenantId: context.tenantId, adId: ad.adId, queueId: queue?.id ?? null,
    enabled: input.enabled, createdBy: context.userId, createdAt: now, updatedAt: now,
  }).onConflictDoUpdate({
    target: [schema.metaAdQueueRoutes.tenantId, schema.metaAdQueueRoutes.adId],
    set: { queueId: queue?.id ?? null, enabled: input.enabled, updatedAt: now },
  });
  await db.insert(schema.auditLogs).values({
    id: randomUUID(), userId: context.userId, entidade: "meta_ad_queue_route", entidadeId: ad.adId,
    acao: input.enabled ? "meta_ad_queue_route.saved" : "meta_ad_queue_route.paused",
  });
  return { adId: ad.adId, queueId: queue?.id ?? null, enabled: input.enabled };
}

export async function simulateDistribution(context: TenantContext, rawInput: unknown) {
  const input = simulationInput.parse(rawInput);
  if (input.branchId) {
    assertManager(context, input.branchId);
  }
  const db = getDatabase();
  const branchCond = input.branchId ? eq(schema.leadQueues.branchId, input.branchId) : undefined;
  const [queue] = await db.select({ id: schema.leadQueues.id, name: schema.leadQueues.name, strategy: schema.leadQueues.assignmentStrategy, capacityEnabled: schema.leadQueues.capacityEnabled, capacity: schema.leadQueues.capacityPerBroker, status: schema.leadQueues.status })
    .from(schema.leadQueues).where(and(eq(schema.leadQueues.id, input.queueId ?? ""), eq(schema.leadQueues.tenantId, context.tenantId), branchCond)).limit(1);
  const fallbackQueue = !queue ? await db.select({ id: schema.leadQueues.id, name: schema.leadQueues.name, strategy: schema.leadQueues.assignmentStrategy, capacityEnabled: schema.leadQueues.capacityEnabled, capacity: schema.leadQueues.capacityPerBroker, status: schema.leadQueues.status })
    .from(schema.leadQueues).where(and(eq(schema.leadQueues.tenantId, context.tenantId), branchCond, eq(schema.leadQueues.status, "active"))).orderBy(desc(schema.leadQueues.isDefault), asc(schema.leadQueues.createdAt)).limit(1) : [];
  const effectiveQueue = queue ?? fallbackQueue[0];
  if (!effectiveQueue || effectiveQueue.status !== "active") return { queue: null, eligible: [], selected: null, reason: "Não existe uma fila ativa para esta unidade." };

  const [policyRow] = await db.select({ policy: schema.leadDistributionPolicies.policy }).from(schema.leadDistributionPolicies)
    .where(and(eq(schema.leadDistributionPolicies.tenantId, context.tenantId), eq(schema.leadDistributionPolicies.queueId, effectiveQueue.id), eq(schema.leadDistributionPolicies.enabled, true))).limit(1);

  const policy = readPolicy(policyRow?.policy);
  const targetBranchIds = Array.from(new Set([input.branchId, ...(policy.allowedBranchIds ?? [])].filter((id): id is string => typeof id === "string" && id.length > 0)));

  const brokers = await db.select({ id: schema.user.id, name: schema.user.name, createdAt: schema.user.createdAt })
    .from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId),
      targetBranchIds.length ? inArray(schema.tenantMemberships.branchId, targetBranchIds) : undefined,
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.status, "active"),
      eq(schema.tenantMemberships.availabilityStatus, "available"),
      eq(schema.user.active, true),
      eq(schema.user.status, "active")
    )).orderBy(asc(schema.user.createdAt));

  const allowedBrokerSet = policy.allowedBrokerIds?.length ? new Set(policy.allowedBrokerIds) : null;
  const ids = brokers
    .map((broker) => broker.id)
    .filter((id) => !policy.excludedBrokerIds.includes(id) && (!allowedBrokerSet || allowedBrokerSet.has(id)));

  if (!ids.length) return { queue: effectiveQueue, eligible: [], selected: null, reason: "Nenhum corretor disponível atende a política desta fila." };
  const loads = await db.select({ brokerId: schema.leads.corretorId, total: count(schema.leads.id) }).from(schema.leads)
    .where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.corretorId, ids), inArray(schema.leads.status, ["distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"]))).groupBy(schema.leads.corretorId);
  const loadByBroker = new Map(loads.map((row) => [row.brokerId, Number(row.total)]));
  const candidates: RankedBroker[] = brokers.filter((broker) => ids.includes(broker.id)).map((broker) => {
    const activeLeads = loadByBroker.get(broker.id) ?? 0;
    const candidate = { id: broker.id, createdAt: broker.createdAt, activeLeads, capacity: effectiveQueue.capacityEnabled ? effectiveQueue.capacity : null, onDuty: false, conversionRate: 0, slaRate: 0, manualPriority: input.temperature === "hot" || input.score >= 80 ? 1 : 0, idleSince: null, rankingScore: 0 };
    return { ...candidate, rankingScore: calculateBrokerRankingScore(candidate, policy) };
  });
  const decision = resolveDistributionCandidate(candidates, policy, effectiveQueue.strategy === "round_robin" ? "round_robin" : "capacity");
  return {
    queue: effectiveQueue,
    eligible: decision.eligible.map((candidate) => ({ id: candidate.id, name: brokers.find((broker) => broker.id === candidate.id)?.name ?? "Corretor", activeLeads: candidate.activeLeads, capacity: candidate.capacity, score: candidate.rankingScore })),
    selected: decision.selected ? { id: decision.selected.id, name: brokers.find((broker) => broker.id === decision.selected?.id)?.name ?? "Corretor", activeLeads: decision.selected.activeLeads, capacity: decision.selected.capacity } : null,
    reason: decision.selected ? "A simulação usa a mesma ordenação determinística da distribuição automática. Nenhum dado foi alterado." : "Todos os corretores elegíveis estão na capacidade da fila.",
  };
}

export async function deleteDistributionQueue(context: TenantContext, queueId: string) {
  const db = getDatabase();
  const [queue] = await db
    .select({
      id: schema.leadQueues.id,
      branchId: schema.leadQueues.branchId,
      isDefault: schema.leadQueues.isDefault,
    })
    .from(schema.leadQueues)
    .where(
      and(
        eq(schema.leadQueues.id, queueId),
        eq(schema.leadQueues.tenantId, context.tenantId),
        isNull(schema.leadQueues.deletedAt)
      )
    )
    .limit(1);

  if (!queue) throw new AuthorizationError("Fila não encontrada ou já removida.");
  if (queue.isDefault) throw new Error("A fila padrão da unidade não pode ser excluída.");
  assertManager(context, queue.branchId);

  const now = new Date();
  await db
    .update(schema.leadQueues)
    .set({ status: "inactive", deletedAt: now, updatedAt: now })
    .where(eq(schema.leadQueues.id, queue.id));

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "lead_queue",
    entidadeId: queue.id,
    acao: "queue.deleted",
  });

  return { success: true };
}
