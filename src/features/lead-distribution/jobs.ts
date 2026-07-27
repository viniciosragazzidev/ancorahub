import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, lt, lte, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { getSystemSettings } from "@/features/system-settings/queries";

import { processQueuedLead } from "./service";
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
  await getDatabase().insert(schema.leadDistributionJobs).values({
    id: randomUUID(),
    tenantId: input.tenantId,
    leadId: input.leadId,
    type: JOB_TYPE,
    status: "pending",
    maxAttempts: input.maxAttempts ?? defaults.maxAttempts,
    runAfter: input.runAfter ?? now,
    idempotencyKey: `${JOB_TYPE}:${input.leadId}`,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();
}

async function seedQueuedLeadJobs(config: DistributionJobConfig, tenantId?: string) {
  const db = getDatabase();
  const queuedLeads = await db.select({ id: schema.leads.id, tenantId: schema.leads.tenantId })
    .from(schema.leads)
    .where(and(
      eq(schema.leads.distributionStatus, "queued"),
      isNull(schema.leads.corretorId),
      tenantId ? eq(schema.leads.tenantId, tenantId) : undefined,
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

async function recoverExpiredJobLeases(now: Date) {
  const result = await getDatabase().update(schema.leadDistributionJobs).set({
    status: "retrying",
    lockedAt: null,
    lockedBy: null,
    leaseExpiresAt: null,
    runAfter: now,
    lastErrorCode: "LEASE_EXPIRED",
    lastErrorMessage: "A execução anterior excedeu o lease e foi recuperada.",
    updatedAt: now,
  }).where(and(eq(schema.leadDistributionJobs.status, "processing"), lt(schema.leadDistributionJobs.leaseExpiresAt, now))).returning({ id: schema.leadDistributionJobs.id });
  return result.length;
}

async function recoverStuckLeadAssignments(now: Date, config: DistributionJobConfig, tenantId?: string) {
  const cutoff = new Date(now.getTime() - config.recoveryMinutes * 60_000);
  const db = getDatabase();
  const stuck = await db.select({ id: schema.leads.id, tenantId: schema.leads.tenantId })
    .from(schema.leads)
    .where(and(
      eq(schema.leads.distributionStatus, "assigning"),
      isNull(schema.leads.corretorId),
      lte(schema.leads.distributionUpdatedAt, cutoff),
      tenantId ? eq(schema.leads.tenantId, tenantId) : undefined,
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

async function claimNextJob(workerId: string, config: DistributionJobConfig, tenantId?: string) {
  const now = new Date();
  const [candidate] = await getDatabase().select({ id: schema.leadDistributionJobs.id })
    .from(schema.leadDistributionJobs)
    .where(and(
      eq(schema.leadDistributionJobs.type, JOB_TYPE),
      inArray(schema.leadDistributionJobs.status, [...ACTIVE_JOB_STATUSES]),
      lte(schema.leadDistributionJobs.runAfter, now),
      tenantId ? eq(schema.leadDistributionJobs.tenantId, tenantId) : undefined,
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
  )).returning();
  return claimed ?? null;
}

async function completeJob(jobId: string) {
  const now = new Date();
  await getDatabase().update(schema.leadDistributionJobs).set({ status: "completed", completedAt: now, lockedAt: null, lockedBy: null, leaseExpiresAt: null, lastErrorCode: null, lastErrorMessage: null, updatedAt: now }).where(eq(schema.leadDistributionJobs.id, jobId));
}

async function deferOrFailJob(job: typeof schema.leadDistributionJobs.$inferSelect, config: DistributionJobConfig, code: string, message: string, defer: boolean) {
  const now = new Date();
  const exhausted = !defer && job.attemptCount >= job.maxAttempts;
  await getDatabase().update(schema.leadDistributionJobs).set({
    status: exhausted ? "failed" : "retrying",
    attemptCount: defer ? sql`greatest(${schema.leadDistributionJobs.attemptCount} - 1, 0)` : job.attemptCount,
    runAfter: exhausted ? now : new Date(now.getTime() + (defer ? Math.max(config.retryBaseSeconds * 2, 120) * 1000 : distributionRetryDelayMilliseconds(job.attemptCount, config.retryBaseSeconds))),
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

export async function runLeadDistributionProcessor(input: { tenantId?: string; limit?: number } = {}): Promise<DistributionJobRunResult> {
  const config = await getDistributionJobConfig();
  const result: DistributionJobRunResult = { seeded: 0, claimed: 0, assigned: 0, deferred: 0, failed: 0, skipped: 0, recoveredLeases: 0, recoveredAssignments: 0 };
  if (!config.enabled) return result;

  const effectiveConfig = { ...config, batchSize: Math.min(input.limit ?? config.batchSize, config.batchSize) };
  const now = new Date();
  result.recoveredLeases = await recoverExpiredJobLeases(now);
  result.recoveredAssignments = await recoverStuckLeadAssignments(now, effectiveConfig, input.tenantId);
  result.seeded = await seedQueuedLeadJobs(effectiveConfig, input.tenantId);
  const workerId = `distribution:${randomUUID()}`;

  for (let index = 0; index < effectiveConfig.batchSize; index += 1) {
    const job = await claimNextJob(workerId, effectiveConfig, input.tenantId);
    if (!job) break;
    result.claimed += 1;
    const context = await getAutomationContext(job.tenantId);
    if (!context) {
      const failed = await deferOrFailJob(job, effectiveConfig, "NO_AUTOMATION_ACTOR", "Não existe Diretor ativo para auditar a distribuição automática.", true);
      if (failed) result.failed += 1; else result.deferred += 1;
      continue;
    }
    try {
      const distribution = await processQueuedLead(context, job.leadId);
      if (distribution.status === "assigned") {
        await completeJob(job.id);
        result.assigned += 1;
        continue;
      }
      const reason = distribution.reason ?? "O lead não está pronto para atribuição automática.";
      const deferred = isDeferredDistributionReason(reason);
      const failed = await deferOrFailJob(job, effectiveConfig, deferred ? "AWAITING_ELIGIBILITY" : "DISTRIBUTION_CONFLICT", reason, deferred);
      if (failed) result.failed += 1; else result.deferred += 1;
    } catch (error) {
      const failed = await deferOrFailJob(job, effectiveConfig, "PROCESSING_ERROR", sanitizeError(error), false);
      if (failed) result.failed += 1; else result.deferred += 1;
    }
  }
  return result;
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
