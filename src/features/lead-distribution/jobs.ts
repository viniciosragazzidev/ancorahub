import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { getSystemSettings } from "@/features/system-settings/queries";
import { runWithConcurrency } from "@/utils/async/run-with-concurrency";
import { processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";

import { processQueuedLead } from "./service";
import { expireOutdatedLeadOffers } from "./offers";
import { distributionRetryDelayMilliseconds, isDeferredDistributionReason } from "./domain";

const JOB_TYPE = "process_queued_lead";
const ACTIVE_JOB_STATUSES = ["pending", "retrying"] as const;

const defaults = {
  enabled: true,
  batchSize: 25,
  maxAttempts: 8,
  retryBaseSeconds: 60,
  leaseSeconds: 120,
  recoveryMinutes: 5,
};

export type DistributionJobConfig = typeof defaults;
export type DistributionJobRunResult = {
  seeded: number;
  claimed: number;
  assigned: number;
  offered: number;
  outboundMessageIds: string[];
  deferred: number;
  failed: number;
  skipped: number;
  recoveredLeases: number;
  recoveredAssignments: number;
};

function readBoundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export async function getDistributionJobConfig(): Promise<DistributionJobConfig> {
  const values = await getSystemSettings([
    "feature_lead_distribution_jobs_enabled",
    "lead_distribution_jobs_batch_size",
    "lead_distribution_jobs_max_attempts",
    "lead_distribution_jobs_retry_base_seconds",
    "lead_distribution_jobs_lease_seconds",
    "lead_distribution_jobs_recovery_minutes",
  ]);
  const settings = new Map(values.map((value) => [value.key, value.value]));
  return {
    enabled: settings.get("feature_lead_distribution_jobs_enabled") !== "false",
    batchSize: readBoundedInteger(settings.get("lead_distribution_jobs_batch_size"), defaults.batchSize, 1, 100),
    maxAttempts: readBoundedInteger(settings.get("lead_distribution_jobs_max_attempts"), defaults.maxAttempts, 1, 20),
    retryBaseSeconds: readBoundedInteger(settings.get("lead_distribution_jobs_retry_base_seconds"), defaults.retryBaseSeconds, 15, 3600),
    leaseSeconds: readBoundedInteger(settings.get("lead_distribution_jobs_lease_seconds"), defaults.leaseSeconds, 30, 900),
    recoveryMinutes: readBoundedInteger(settings.get("lead_distribution_jobs_recovery_minutes"), defaults.recoveryMinutes, 1, 60),
  };
}

export async function enqueueLeadDistributionJob(input: { tenantId: string; leadId: string; runAfter?: Date; maxAttempts?: number }) {
  const now = new Date();
  // DEC-097: ownership recovery runs 24/7. Message delivery still follows
  // the Meta window in the outbox; the assignment itself is never delayed.
  const runAfter = input.runAfter ?? now;
  await getDatabase().insert(schema.leadDistributionJobs).values({
    id: randomUUID(),
    tenantId: input.tenantId,
    leadId: input.leadId,
    type: JOB_TYPE,
    status: "pending",
    maxAttempts: input.maxAttempts ?? defaults.maxAttempts,
    runAfter,
    idempotencyKey: `${JOB_TYPE}:${input.leadId}`,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();
}

export async function wakeLeadDistributionJob(tenantId: string, leadId: string) {
  const now = new Date();
  await getDatabase().update(schema.leadDistributionJobs).set({
    status: "retrying",
    runAfter: now,
    lockedAt: null,
    lockedBy: null,
    leaseExpiresAt: null,
    completedAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    updatedAt: now,
  }).where(and(
    eq(schema.leadDistributionJobs.tenantId, tenantId),
    eq(schema.leadDistributionJobs.leadId, leadId),
    inArray(schema.leadDistributionJobs.status, ["pending", "retrying"]),
  ));
}

/**
 * Persists the distribution intent before attempting the immediate path.
 *
 * A handoff must never depend exclusively on the scheduler: during business
 * hours we try the same durable job immediately, while the pending job remains
 * the recovery mechanism if the processor cannot finish this attempt.
 */
export async function enqueueAndProcessLeadDistribution(input: {
  tenantId: string;
  leadId: string;
  source: "qualification_timeout" | "human_handoff" | "agent_trigger" | "offer_declined" | "sla_timeout" | "intake" | "bulk_recovery";
}) {
  await enqueueLeadDistributionJob({ tenantId: input.tenantId, leadId: input.leadId });
  await wakeLeadDistributionJob(input.tenantId, input.leadId);

  try {
    const result = await runLeadDistributionProcessor({
      tenantId: input.tenantId,
      leadId: input.leadId,
      limit: 1,
    });
    await runWithConcurrency(result.outboundMessageIds, 3, async (outboundMessageId) => {
      await processMetaOutboundBatch(1, input.tenantId, outboundMessageId);
    });
    console.info("[lead-distribution] immediate_attempt", {
      tenantId: input.tenantId,
      leadId: input.leadId,
      source: input.source,
      assigned: result.assigned,
      deferred: result.deferred,
      failed: result.failed,
    });
    return result;
  } catch (error) {
    const message = sanitizeError(error);
    console.error("[lead-distribution] immediate_attempt_failed", {
      tenantId: input.tenantId,
      leadId: input.leadId,
      source: input.source,
      message,
    });
    // The job was persisted before this best-effort attempt and will be
    // recovered by the processor/scheduler without losing the handoff.
    return null;
  }
}

// DEC-097: the business-hours deferral block was removed. Ownership recovery
// processes the durable queue 24/7; outbound message delivery keeps
// its own Meta window inside the outbox.

async function seedQueuedLeadJobs(config: DistributionJobConfig, tenantId?: string, leadId?: string) {
  const db = getDatabase();
  const queuedLeads = await db.select({ id: schema.leads.id, tenantId: schema.leads.tenantId })
    .from(schema.leads)
    .where(and(
      or(
        and(
          inArray(schema.leads.distributionStatus, ["queued", "unassigned", "returned_to_queue"]),
          isNull(schema.leads.corretorId),
        ),
        and(
          eq(schema.leads.distributionStatus, "assigned"),
          eq(schema.leads.assignmentSource, "automatic_offer"),
          isNotNull(schema.leads.corretorId),
        ),
      ),
      or(isNull(schema.leads.qualificationState), ne(schema.leads.qualificationState, "IN_PROGRESS")),
      or(isNull(schema.leads.qualificationStatus), ne(schema.leads.qualificationStatus, "qualifying")),
      tenantId ? eq(schema.leads.tenantId, tenantId) : undefined,
      leadId ? eq(schema.leads.id, leadId) : undefined,
    ))
    .orderBy(asc(schema.leads.distributionUpdatedAt), asc(schema.leads.createdAt))
    .limit(config.batchSize);

  await Promise.all(queuedLeads.map((lead) => enqueueLeadDistributionJob({ tenantId: lead.tenantId, leadId: lead.id, maxAttempts: config.maxAttempts })));
  return queuedLeads.length;
}

async function getAutomationContext(tenantId: string): Promise<TenantContext | null> {
  const [director] = await getDatabase().select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .where(and(
      eq(schema.tenantMemberships.tenantId, tenantId),
      eq(schema.tenantMemberships.role, "director"),
      eq(schema.tenantMemberships.status, "active"),
      eq(schema.user.active, true),
      eq(schema.user.status, "active"),
    ))
    .orderBy(asc(schema.tenantMemberships.createdAt))
    .limit(1);
  return director ? { userId: director.userId, tenantId, role: "director", jobTitle: "director", branchId: null } : null;
}

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha inesperada no processamento.";
  return message.replace(/[\r\n]+/g, " ").slice(0, 240);
}

async function recoverExpiredJobLeases(now: Date, tenantId?: string, leadId?: string) {
  const result = await getDatabase().update(schema.leadDistributionJobs).set({
    status: "retrying",
    lockedAt: null,
    lockedBy: null,
    leaseExpiresAt: null,
    runAfter: now,
    lastErrorCode: "LEASE_EXPIRED",
    lastErrorMessage: "A execução anterior excedeu o lease e foi recuperada.",
    updatedAt: now,
  }).where(and(
    eq(schema.leadDistributionJobs.status, "processing"),
    lt(schema.leadDistributionJobs.leaseExpiresAt, now),
    tenantId ? eq(schema.leadDistributionJobs.tenantId, tenantId) : undefined,
    leadId ? eq(schema.leadDistributionJobs.leadId, leadId) : undefined,
  )).returning({ id: schema.leadDistributionJobs.id });
  return result.length;
}

async function recoverStuckLeadAssignments(now: Date, config: DistributionJobConfig, tenantId?: string, leadId?: string) {
  const cutoff = new Date(now.getTime() - config.recoveryMinutes * 60_000);
  const db = getDatabase();
  const stuck = await db.select({ id: schema.leads.id, tenantId: schema.leads.tenantId })
    .from(schema.leads)
    .where(and(
      eq(schema.leads.distributionStatus, "assigning"),
      isNull(schema.leads.corretorId),
      lte(schema.leads.distributionUpdatedAt, cutoff),
      tenantId ? eq(schema.leads.tenantId, tenantId) : undefined,
      leadId ? eq(schema.leads.id, leadId) : undefined,
    ))
    .limit(config.batchSize);

  for (const lead of stuck) {
    const context = await getAutomationContext(lead.tenantId);
    if (!context) continue;
    const recovered = await db.transaction(async (tx) => {
      const changed = await tx.update(schema.leads).set({ distributionStatus: "queued", assignmentSource: "system_recovery", distributionUpdatedAt: now })
        .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, lead.tenantId), eq(schema.leads.distributionStatus, "assigning"), isNull(schema.leads.corretorId)))
        .returning({ id: schema.leads.id });
      if (!changed.length) return false;
      await tx.insert(schema.leadDistributionEvents).values({ id: randomUUID(), tenantId: lead.tenantId, leadId: lead.id, action: "assignment_recovered", source: "system_recovery", strategy: "automatic", reason: "Atribuição interrompida recuperada pelo motor.", actorId: context.userId, createdAt: now });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_distribution", entidadeId: lead.id, acao: "lead.assignment_recovered" });
      return true;
    });
    if (recovered) await enqueueLeadDistributionJob({ tenantId: lead.tenantId, leadId: lead.id, maxAttempts: config.maxAttempts });
  }
  return stuck.length;
}

async function claimNextJob(workerId: string, config: DistributionJobConfig, tenantId?: string, leadId?: string) {
  const now = new Date();
  const [candidate] = await getDatabase().select({ id: schema.leadDistributionJobs.id })
    .from(schema.leadDistributionJobs)
    .where(and(
      eq(schema.leadDistributionJobs.type, JOB_TYPE),
      inArray(schema.leadDistributionJobs.status, [...ACTIVE_JOB_STATUSES]),
      lte(schema.leadDistributionJobs.runAfter, now),
      tenantId ? eq(schema.leadDistributionJobs.tenantId, tenantId) : undefined,
      leadId ? eq(schema.leadDistributionJobs.leadId, leadId) : undefined,
    ))
    .orderBy(asc(schema.leadDistributionJobs.runAfter), asc(schema.leadDistributionJobs.createdAt))
    .limit(1);
  if (!candidate) return null;

  const [claimed] = await getDatabase().update(schema.leadDistributionJobs).set({
    status: "processing",
    attemptCount: sql`${schema.leadDistributionJobs.attemptCount} + 1`,
    lockedAt: now,
    lockedBy: workerId,
    leaseExpiresAt: new Date(now.getTime() + config.leaseSeconds * 1000),
    updatedAt: now,
  }).where(and(
    eq(schema.leadDistributionJobs.id, candidate.id),
    inArray(schema.leadDistributionJobs.status, [...ACTIVE_JOB_STATUSES]),
    lte(schema.leadDistributionJobs.runAfter, now),
    tenantId ? eq(schema.leadDistributionJobs.tenantId, tenantId) : undefined,
    leadId ? eq(schema.leadDistributionJobs.leadId, leadId) : undefined,
  )).returning();
  return claimed ?? null;
}

async function completeJob(jobId: string) {
  const now = new Date();
  await getDatabase().update(schema.leadDistributionJobs).set({ status: "completed", completedAt: now, lockedAt: null, lockedBy: null, leaseExpiresAt: null, lastErrorCode: null, lastErrorMessage: null, updatedAt: now }).where(eq(schema.leadDistributionJobs.id, jobId));
}

async function deferOrFailJob(
  job: typeof schema.leadDistributionJobs.$inferSelect,
  config: DistributionJobConfig,
  code: string,
  message: string,
  defer: boolean,
  runAfterOverride?: Date,
) {
  const now = new Date();
  const exhausted = !defer && job.attemptCount >= job.maxAttempts;
  const nextRunAfter = exhausted
    ? now
    : runAfterOverride ?? new Date(
      now.getTime() + (
        defer
          ? Math.max(config.retryBaseSeconds * 2, 120) * 1000
          : distributionRetryDelayMilliseconds(job.attemptCount, config.retryBaseSeconds)
      ),
    );
  await getDatabase().update(schema.leadDistributionJobs).set({
    status: exhausted ? "failed" : "retrying",
    attemptCount: defer ? sql`greatest(${schema.leadDistributionJobs.attemptCount} - 1, 0)` : job.attemptCount,
    runAfter: nextRunAfter,
    lockedAt: null,
    lockedBy: null,
    leaseExpiresAt: null,
    lastErrorCode: code,
    lastErrorMessage: message,
    completedAt: exhausted ? now : null,
    updatedAt: now,
  }).where(eq(schema.leadDistributionJobs.id, job.id));
  return exhausted;
}

export async function runLeadDistributionProcessor(input: { tenantId?: string; leadId?: string; limit?: number } = {}): Promise<DistributionJobRunResult> {
  const config = await getDistributionJobConfig();
  const result: DistributionJobRunResult = { seeded: 0, claimed: 0, assigned: 0, offered: 0, outboundMessageIds: [], deferred: 0, failed: 0, skipped: 0, recoveredLeases: 0, recoveredAssignments: 0 };
  if (!config.enabled) return result;

  const effectiveConfig = { ...config, batchSize: Math.min(input.limit ?? config.batchSize, config.batchSize) };
  const now = new Date();
  // DEC-097: ownership recovery runs 24/7 — no business-hours dead-end.
  // Outbound offer/notification delivery still follows the Meta window in the
  // outbox; only the assignment itself is never delayed by the clock.
  await expireOutdatedLeadOffers(input.tenantId);
  result.recoveredLeases = await recoverExpiredJobLeases(now, input.tenantId, input.leadId);
  result.recoveredAssignments = await recoverStuckLeadAssignments(now, effectiveConfig, input.tenantId, input.leadId);
  result.seeded = await seedQueuedLeadJobs(effectiveConfig, input.tenantId, input.leadId);
  const workerId = `distribution:${randomUUID()}`;

  const claimedJobs: Array<typeof schema.leadDistributionJobs.$inferSelect> = [];
  for (let index = 0; index < effectiveConfig.batchSize; index += 1) {
    const job = await claimNextJob(workerId, effectiveConfig, input.tenantId, input.leadId);
    if (!job) break;
    claimedJobs.push(job);
    result.claimed += 1;
  }

  await runWithConcurrency(claimedJobs, Math.min(5, claimedJobs.length || 1), async (job) => {
    const context = await getAutomationContext(job.tenantId);
    if (!context) {
      const failed = await deferOrFailJob(job, effectiveConfig, "NO_AUTOMATION_ACTOR", "Não existe Diretor ativo para auditar a distribuição automática.", true);
      if (failed) result.failed += 1; else result.deferred += 1;
      return;
    }
    try {
      const distribution = await processQueuedLead(context, job.leadId);
      if (distribution.status === "assigned") {
        await completeJob(job.id);
        result.assigned += 1;
        return;
      }
      if (distribution.status === "manual_required") {
        await completeJob(job.id);
        result.skipped += 1;
        return;
      }
      if (distribution.status === "offered") {
        const failed = await deferOrFailJob(
          job,
          effectiveConfig,
          "AWAITING_BROKER_ACCEPTANCE",
          `Oferta ativa para corretor até ${distribution.expiresAt.toISOString()}.`,
          true,
          distribution.expiresAt,
        );
        result.offered += 1;
        if (distribution.outboundMessageId) result.outboundMessageIds.push(distribution.outboundMessageId);
        if (failed) result.failed += 1; else result.deferred += 1;
        return;
      }
      const reason = distribution.reason ?? "O lead não está pronto para atribuição automática.";
      const deferred = isDeferredDistributionReason(reason);
      const failed = await deferOrFailJob(job, effectiveConfig, deferred ? "AWAITING_ELIGIBILITY" : "DISTRIBUTION_CONFLICT", reason, deferred);
      if (failed) result.failed += 1; else result.deferred += 1;
    } catch (error) {
      const failed = await deferOrFailJob(job, effectiveConfig, "PROCESSING_ERROR", sanitizeError(error), false);
      if (failed) result.failed += 1; else result.deferred += 1;
    }
  });
  return result;
}

export async function drainLeadDistributionBacklog(input: { tenantId?: string; maxBatches?: number } = {}) {
  const aggregate: DistributionJobRunResult = { seeded: 0, claimed: 0, assigned: 0, offered: 0, outboundMessageIds: [], deferred: 0, failed: 0, skipped: 0, recoveredLeases: 0, recoveredAssignments: 0 };
  const maxBatches = Math.max(1, Math.min(input.maxBatches ?? 4, 10));
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const result = await runLeadDistributionProcessor({ tenantId: input.tenantId });
    for (const key of ["seeded", "claimed", "assigned", "offered", "deferred", "failed", "skipped", "recoveredLeases", "recoveredAssignments"] as const) {
      aggregate[key] += result[key];
    }
    aggregate.outboundMessageIds.push(...result.outboundMessageIds);
    await runWithConcurrency(result.outboundMessageIds, 3, async (outboundMessageId) => {
      await processMetaOutboundBatch(1, input.tenantId, outboundMessageId);
    });
    if (result.claimed === 0) break;
  }
  return aggregate;
}

export async function getLeadDistributionJobHealth(tenantId?: string) {
  try {
    const db = getDatabase();
    const rows = await db.select({ status: schema.leadDistributionJobs.status, total: sql<number>`count(*)` })
      .from(schema.leadDistributionJobs)
      .where(tenantId ? eq(schema.leadDistributionJobs.tenantId, tenantId) : undefined)
      .groupBy(schema.leadDistributionJobs.status);
    const counts = new Map(rows.map((row) => [row.status, Number(row.total)]));
    return { available: true, pending: counts.get("pending") ?? 0, retrying: counts.get("retrying") ?? 0, processing: counts.get("processing") ?? 0, failed: counts.get("failed") ?? 0, completed: counts.get("completed") ?? 0 };
  } catch (error) {
    const databaseError = error as { code?: string; cause?: { code?: string } };
    if (databaseError.code === "42P01" || databaseError.cause?.code === "42P01") return { available: false, pending: 0, retrying: 0, processing: 0, failed: 0, completed: 0 };
    throw error;
  }
}
