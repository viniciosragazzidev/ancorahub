import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getDatabase, schema } from "@/shared/db";

const BATCH_SIZE = 500;
const LEADS_BATCH_SIZE = 20;
const BATCH_YIELD_MS = 50;

/**
 * Serverless functions are killed after maxDuration. Each processing slice
 * must stay well below the route limit so the job can be resumed by the
 * /api/internal/jobs/purge cron until it reaches "completed".
 */
export const PURGE_SLICE_BUDGET_MS = 45_000;

type PurgePhase =
  | "starting"
  | "outboxes"
  | "ai_logs"
  | "notifications"
  | "interactions"
  | "documents"
  | "sales"
  | "marketing"
  | "tasks"
  | "quotes"
  | "clients"
  | "leads"
  | "completed"
  | "failed";

/**
 * Start a purge job. Returns immediately with a jobId.
 * The actual deletion runs in time-boxed slices via processPurgeJob,
 * driven by the /api/internal/jobs/purge cron (resumable until completed).
 */
export async function startPurgeJob(tenantId: string): Promise<{ jobId: string }> {
  const admin = await getRequiredPlatformAdmin();
  const db = getDatabase();
  const now = new Date();

  // Prevent duplicate active purge for same tenant
  const [existing] = await db
    .select({ id: schema.platformPurgeJobs.id })
    .from(schema.platformPurgeJobs)
    .where(
      and(
        eq(schema.platformPurgeJobs.tenantId, tenantId),
        inArray(schema.platformPurgeJobs.status, ["pending", "running"]),
      ),
    )
    .limit(1);

  if (existing) {
    throw new Error("Já existe um purge em andamento para esta empresa.");
  }

  // Count leads and conversations for progress tracking
  const [{ count: totalLeads }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.leads)
    .where(eq(schema.leads.tenantId, tenantId));

  const [{ count: totalConversations }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.aiConversations)
    .where(eq(schema.aiConversations.tenantId, tenantId));

  const jobId = randomUUID();
  await db.insert(schema.platformPurgeJobs).values({
    id: jobId,
    tenantId,
    actorUserId: admin.userId,
    status: "pending",
    totalLeads,
    deletedLeads: 0,
    totalConversations,
    deletedConversations: 0,
    currentPhase: "starting",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.platformAuditLogs).values({
    id: randomUUID(),
    actorUserId: admin.userId,
    action: "tenant.purge_started",
    targetType: "tenant",
    targetId: tenantId,
    metadata: { jobId, totalLeads: String(totalLeads), totalConversations: String(totalConversations) },
    createdAt: now,
  });

  return { jobId };
}

/**
 * Picks the oldest active (pending/running) purge job and processes it for a
 * bounded time slice. Jobs left as "running" by a crashed/timeout invocation
 * are automatically resumed here.
 */
export async function processPendingPurgeJobs(timeBudgetMs = PURGE_SLICE_BUDGET_MS): Promise<{
  processed: boolean;
  jobId?: string;
  completed?: boolean;
}> {
  const db = getDatabase();
  const [job] = await db
    .select({ id: schema.platformPurgeJobs.id })
    .from(schema.platformPurgeJobs)
    .where(inArray(schema.platformPurgeJobs.status, ["pending", "running"]))
    .orderBy(asc(schema.platformPurgeJobs.createdAt))
    .limit(1);

  if (!job) return { processed: false };

  const result = await processPurgeJob(job.id, { timeBudgetMs });
  return { processed: true, jobId: job.id, completed: result.completed };
}

type TransientQueryError = { code?: string; cause?: { code?: string } };

/**
 * Statement timeouts, deadlocks and lock waits are transient under load:
 * keep the job resumable (running) so the cron retries it, instead of
 * marking it permanently failed.
 */
function isTransientQueryError(error: unknown) {
  const queryError = error as TransientQueryError;
  const code = queryError?.code ?? queryError?.cause?.code;
  return code === "57014" || code === "40P01" || code === "55P03" || code === "53300";
}

/**
 * Process a purge job in batches within a time budget.
 * Every phase is idempotent (delete-based), so an interrupted slice can be
 * safely resumed: the next invocation re-scans phases and continues.
 * Returns { completed: false } when the budget ran out — the job stays
 * "running" and the cron resumes it on the next tick.
 */
export async function processPurgeJob(
  jobId: string,
  options: { timeBudgetMs?: number } = {},
): Promise<{ completed: boolean }> {
  const budgetMs = options.timeBudgetMs ?? PURGE_SLICE_BUDGET_MS;
  const deadline = Date.now() + budgetMs;
  const hasBudget = () => Date.now() < deadline;

  const db = getDatabase();
  const [job] = await db
    .select()
    .from(schema.platformPurgeJobs)
    .where(eq(schema.platformPurgeJobs.id, jobId))
    .limit(1);

  if (!job || job.status === "completed" || job.status === "failed") {
    return { completed: job?.status === "completed" };
  }

  // Mark as running
  await db
    .update(schema.platformPurgeJobs)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(schema.platformPurgeJobs.id, jobId));

  try {
    const tenantId = job.tenantId;

    // Phase 1: Outboxes and cadence
    await updatePhase(db, jobId, "outboxes");
    if (!(await batchDelete(db, schema.wahaDeliveryOutbox, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);
    if (!(await batchDelete(db, schema.wahaCadenceRuns, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);
    if (!(await batchDelete(db, schema.leadEffectOutbox, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);
    if (!(await batchDelete(db, schema.leadDistributionJobs, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);
    if (!(await batchDelete(db, schema.leadDistributionEvents, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);

    // Phase 2: AI logs and messages
    await updatePhase(db, jobId, "ai_logs");
    if (!(await batchDelete(db, schema.aiAttendanceLogs, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);
    if (!(await batchDelete(db, schema.aiQuickReplyEvents, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);
    if (!(await batchDelete(db, schema.whatsappMessages, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);
    if (!(await batchDeleteConversations(db, jobId, tenantId, hasBudget))) return notFinished(db, jobId);
    if (!(await batchDelete(db, schema.aiQualificationSessions, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);
    if (!(await batchDelete(db, schema.agentTrainingSimulations, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);

    // Phase 3: Notifications, feedbacks, attempts
    await updatePhase(db, jobId, "notifications");
    if (!(await batchDelete(db, schema.notifications, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);
    if (!(await batchDelete(db, schema.leadFeedbacks, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);
    if (!(await batchDelete(db, schema.leadAssignmentAttempts, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);

    // Phase 4: Interactions (need lead IDs first)
    await updatePhase(db, jobId, "interactions");
    if (!(await batchDeleteInteractions(db, tenantId, hasBudget))) return notFinished(db, jobId);
    if (!(await batchDelete(db, schema.leadBeneficiaries, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);

    // Phase 5: Documents and offers
    await updatePhase(db, jobId, "documents");
    if (!(await batchDelete(db, schema.leadOffers, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);
    if (!(await batchDelete(db, schema.leadDocumentChecklist, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);
    if (!(await batchDelete(db, schema.leadDocuments, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);

    // Phase 6: Sales and commissions
    await updatePhase(db, jobId, "sales");
    if (!(await batchDelete(db, schema.sales, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);
    if (!(await batchDelete(db, schema.commissionSchedule, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);

    // Phase 7: Marketing
    await updatePhase(db, jobId, "marketing");
    if (!(await batchDeleteMarketing(db, tenantId, hasBudget))) return notFinished(db, jobId);
    if (!(await batchDelete(db, schema.whatsappOutboundMessages, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);

    // Phase 8: Tasks
    await updatePhase(db, jobId, "tasks");
    if (!(await batchDeleteTasks(db, tenantId, hasBudget))) return notFinished(db, jobId);

    // Phase 9: Quotes
    await updatePhase(db, jobId, "quotes");
    if (!(await batchDeleteQuotes(db, tenantId, hasBudget))) return notFinished(db, jobId);

    // Phase 10: Clients and webhooks
    await updatePhase(db, jobId, "clients");
    if (!(await batchDelete(db, schema.clients, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);
    if (!(await batchDelete(db, schema.webhookDeliveries, "tenantId", tenantId, hasBudget))) return notFinished(db, jobId);

    // Phase 11: Leads (the big one — cascades need FK indexes, added in 0135)
    await updatePhase(db, jobId, "leads");
    const deletedLeads = await batchDeleteLeads(db, jobId, tenantId, hasBudget);
    if (deletedLeads === null) return notFinished(db, jobId);

    // Complete
    await db
      .update(schema.platformPurgeJobs)
      .set({
        status: "completed",
        currentPhase: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.platformPurgeJobs.id, jobId));

    await db.insert(schema.platformAuditLogs).values({
      id: randomUUID(),
      actorUserId: job.actorUserId,
      action: "tenant.purge_completed",
      targetType: "tenant",
      targetId: tenantId,
      metadata: { jobId, deletedLeads: String(deletedLeads ?? job.deletedLeads ?? 0) },
      createdAt: new Date(),
    });

    return { completed: true };
  } catch (error) {
    if (isTransientQueryError(error)) {
      // Stay resumable: the cron retries on the next tick.
      await notFinished(db, jobId);
      return { completed: false };
    }

    await db
      .update(schema.platformPurgeJobs)
      .set({
        status: "failed",
        error: error instanceof Error ? `${error.message}${error.cause ? ` | cause: ${String(error.cause).slice(0, 300)}` : ""}` : "Erro desconhecido",
        updatedAt: new Date(),
      })
      .where(eq(schema.platformPurgeJobs.id, jobId));

    await db.insert(schema.platformAuditLogs).values({
      id: randomUUID(),
      actorUserId: job.actorUserId,
      action: "tenant.purge_failed",
      targetType: "tenant",
      targetId: job.tenantId,
      metadata: { jobId, error: error instanceof Error ? error.message : "unknown" },
      createdAt: new Date(),
    });

    throw error;
  }
}

async function notFinished(
  db: ReturnType<typeof getDatabase>,
  jobId: string,
): Promise<{ completed: boolean }> {
  await db
    .update(schema.platformPurgeJobs)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(schema.platformPurgeJobs.id, jobId));
  return { completed: false };
}

// ─── Batch Helpers ────────────────────────────────────────────────────

async function updatePhase(
  db: ReturnType<typeof getDatabase>,
  jobId: string,
  phase: PurgePhase,
) {
  await db
    .update(schema.platformPurgeJobs)
    .set({ currentPhase: phase, updatedAt: new Date() })
    .where(eq(schema.platformPurgeJobs.id, jobId));
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, BATCH_YIELD_MS));
}

/**
 * Deletes rows in batches. Returns false when the time budget ran out
 * (job stays resumable); true when the table is fully drained.
 */
async function batchDelete(
  db: ReturnType<typeof getDatabase>,
  table: { tenantId: unknown },
  _column: string,
  tenantId: string,
  hasBudget: () => boolean,
): Promise<boolean> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!hasBudget()) return false;
    const result = await db.execute(sql`
      DELETE FROM ${table}
      WHERE ctid IN (
        SELECT ctid FROM ${table}
        WHERE ${sql`${(table as { tenantId: never }).tenantId}`} = ${tenantId}
        LIMIT ${BATCH_SIZE}
      )
    `);
    const deleted = (result as { rowCount?: number }).rowCount ?? 0;
    if (deleted < BATCH_SIZE) return true;
    await yieldToEventLoop();
  }
}

async function batchDeleteConversations(
  db: ReturnType<typeof getDatabase>,
  jobId: string,
  tenantId: string,
  hasBudget: () => boolean,
): Promise<boolean> {
  let totalDeleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!hasBudget()) return false;
    const result = await db.execute(sql`
      DELETE FROM ${schema.aiConversations}
      WHERE ctid IN (
        SELECT ctid FROM ${schema.aiConversations}
        WHERE ${schema.aiConversations.tenantId} = ${tenantId}
        LIMIT ${BATCH_SIZE}
      )
    `);
    const deleted = (result as { rowCount?: number }).rowCount ?? 0;
    totalDeleted += deleted;
    // Update progress
    await db
      .update(schema.platformPurgeJobs)
      .set({ deletedConversations: totalDeleted, updatedAt: new Date() })
      .where(eq(schema.platformPurgeJobs.id, jobId));
    if (deleted < BATCH_SIZE) return true;
    await yieldToEventLoop();
  }
}

async function batchDeleteInteractions(
  db: ReturnType<typeof getDatabase>,
  tenantId: string,
  hasBudget: () => boolean,
): Promise<boolean> {
  // Get lead IDs in batches and delete interactions for each batch
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!hasBudget()) return false;
    const leadIds = await db.execute(sql`
      SELECT id FROM ${schema.leads}
      WHERE ${schema.leads.tenantId} = ${tenantId}
      LIMIT ${BATCH_SIZE}
    `);
    const ids = ((leadIds as { rows?: { id: string }[] }).rows ?? []).map((r) => r.id);
    if (ids.length === 0) return true;

    await db
      .delete(schema.leadInteractions)
      .where(inArray(schema.leadInteractions.leadId, ids));

    if (ids.length < BATCH_SIZE) return true;
    await yieldToEventLoop();
  }
}

async function batchDeleteMarketing(
  db: ReturnType<typeof getDatabase>,
  tenantId: string,
  hasBudget: () => boolean,
): Promise<boolean> {
  // Delete import results in batches
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!hasBudget()) return false;
    const importIds = await db.execute(sql`
      SELECT id FROM ${schema.marketingImports}
      WHERE ${schema.marketingImports.tenantId} = ${tenantId}
      LIMIT ${BATCH_SIZE}
    `);
    const ids = ((importIds as { rows?: { id: string }[] }).rows ?? []).map((r) => r.id);
    if (ids.length === 0) break;

    await db
      .delete(schema.marketingImportResults)
      .where(inArray(schema.marketingImportResults.importId, ids));

    if (ids.length < BATCH_SIZE) break;
    await yieldToEventLoop();
  }
  return batchDelete(db, schema.marketingImports, "tenantId", tenantId, hasBudget);
}

async function batchDeleteTasks(
  db: ReturnType<typeof getDatabase>,
  tenantId: string,
  hasBudget: () => boolean,
): Promise<boolean> {
  // Delete task assignees in batches
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!hasBudget()) return false;
    const taskIds = await db.execute(sql`
      SELECT id FROM ${schema.leadTasks}
      WHERE ${schema.leadTasks.tenantId} = ${tenantId}
      LIMIT ${BATCH_SIZE}
    `);
    const ids = ((taskIds as { rows?: { id: string }[] }).rows ?? []).map((r) => r.id);
    if (ids.length === 0) break;

    await db
      .delete(schema.leadTaskAssignees)
      .where(inArray(schema.leadTaskAssignees.taskId, ids));

    if (ids.length < BATCH_SIZE) break;
    await yieldToEventLoop();
  }
  return batchDelete(db, schema.leadTasks, "tenantId", tenantId, hasBudget);
}

async function batchDeleteQuotes(
  db: ReturnType<typeof getDatabase>,
  tenantId: string,
  hasBudget: () => boolean,
): Promise<boolean> {
  // Delete quote items in batches
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!hasBudget()) return false;
    const quoteIds = await db.execute(sql`
      SELECT id FROM ${schema.quotes}
      WHERE ${schema.quotes.tenantId} = ${tenantId}
      LIMIT ${BATCH_SIZE}
    `);
    const ids = ((quoteIds as { rows?: { id: string }[] }).rows ?? []).map((r) => r.id);
    if (ids.length === 0) break;

    await db
      .delete(schema.quoteLineItems)
      .where(inArray(schema.quoteLineItems.quoteId, ids));
    await db
      .delete(schema.quoteItems)
      .where(inArray(schema.quoteItems.quoteId, ids));

    if (ids.length < BATCH_SIZE) break;
    await yieldToEventLoop();
  }
  return batchDelete(db, schema.quotes, "tenantId", tenantId, hasBudget);
}

/**
 * Deletes leads in small batches (cascades fan out to many tables).
 * Returns the number deleted in this slice, or null when the budget ran out.
 * Progress is persisted incrementally so resumed slices accumulate correctly.
 */
async function batchDeleteLeads(
  db: ReturnType<typeof getDatabase>,
  jobId: string,
  tenantId: string,
  hasBudget: () => boolean,
): Promise<number | null> {
  let sliceDeleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!hasBudget()) return null;
    const result = await db.execute(sql`
      DELETE FROM ${schema.leads}
      WHERE ctid IN (
        SELECT ctid FROM ${schema.leads}
        WHERE ${schema.leads.tenantId} = ${tenantId}
        LIMIT ${LEADS_BATCH_SIZE}
      )
    `);
    const deleted = (result as { rowCount?: number }).rowCount ?? 0;
    sliceDeleted += deleted;
    if (deleted > 0) {
      await db
        .update(schema.platformPurgeJobs)
        .set({
          deletedLeads: sql`${schema.platformPurgeJobs.deletedLeads} + ${deleted}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.platformPurgeJobs.id, jobId));
    }
    if (deleted < LEADS_BATCH_SIZE) return sliceDeleted;
    await yieldToEventLoop();
  }
}
