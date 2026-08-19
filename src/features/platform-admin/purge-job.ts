import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, sql, inArray } from "drizzle-orm";

import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getDatabase, schema } from "@/shared/db";

const BATCH_SIZE = 500;
const BATCH_YIELD_MS = 50;

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
 * The actual deletion runs in batches via processPurgeJob.
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
        eq(schema.platformPurgeJobs.status, "running"),
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
 * Process a purge job in batches. Called by a cron job or triggered after startPurgeJob.
 * Each phase deletes in batches of BATCH_SIZE rows, yielding between batches.
 */
export async function processPurgeJob(jobId: string): Promise<void> {
  const db = getDatabase();
  const [job] = await db
    .select()
    .from(schema.platformPurgeJobs)
    .where(eq(schema.platformPurgeJobs.id, jobId))
    .limit(1);

  if (!job || job.status === "completed" || job.status === "failed") return;

  // Mark as running
  await db
    .update(schema.platformPurgeJobs)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(schema.platformPurgeJobs.id, jobId));

  try {
    const tenantId = job.tenantId;

    // Phase 1: Outboxes and cadence
    await updatePhase(db, jobId, "outboxes");
    await batchDelete(db, schema.wahaDeliveryOutbox, "tenantId", tenantId);
    await batchDelete(db, schema.wahaCadenceRuns, "tenantId", tenantId);
    await batchDelete(db, schema.leadEffectOutbox, "tenantId", tenantId);
    await batchDelete(db, schema.leadDistributionJobs, "tenantId", tenantId);
    await batchDelete(db, schema.leadDistributionEvents, "tenantId", tenantId);

    // Phase 2: AI logs and messages
    await updatePhase(db, jobId, "ai_logs");
    await batchDelete(db, schema.aiAttendanceLogs, "tenantId", tenantId);
    await batchDelete(db, schema.aiQuickReplyEvents, "tenantId", tenantId);
    await batchDelete(db, schema.whatsappMessages, "tenantId", tenantId);
    await batchDeleteConversations(db, jobId, tenantId);
    await batchDelete(db, schema.aiQualificationSessions, "tenantId", tenantId);
    await batchDelete(db, schema.agentTrainingSimulations, "tenantId", tenantId);

    // Phase 3: Notifications, feedbacks, attempts
    await updatePhase(db, jobId, "notifications");
    await batchDelete(db, schema.notifications, "tenantId", tenantId);
    await batchDelete(db, schema.leadFeedbacks, "tenantId", tenantId);
    await batchDelete(db, schema.leadAssignmentAttempts, "tenantId", tenantId);

    // Phase 4: Interactions (need lead IDs first)
    await updatePhase(db, jobId, "interactions");
    await batchDeleteInteractions(db, tenantId);
    await batchDelete(db, schema.leadBeneficiaries, "tenantId", tenantId);

    // Phase 5: Documents and offers
    await updatePhase(db, jobId, "documents");
    await batchDelete(db, schema.leadOffers, "tenantId", tenantId);
    await batchDelete(db, schema.leadDocumentChecklist, "tenantId", tenantId);
    await batchDelete(db, schema.leadDocuments, "tenantId", tenantId);

    // Phase 6: Sales and commissions
    await updatePhase(db, jobId, "sales");
    await batchDelete(db, schema.sales, "tenantId", tenantId);
    await batchDelete(db, schema.commissionSchedule, "tenantId", tenantId);

    // Phase 7: Marketing
    await updatePhase(db, jobId, "marketing");
    await batchDeleteMarketing(db, tenantId);
    await batchDelete(db, schema.whatsappOutboundMessages, "tenantId", tenantId);

    // Phase 8: Tasks
    await updatePhase(db, jobId, "tasks");
    await batchDeleteTasks(db, tenantId);

    // Phase 9: Quotes
    await updatePhase(db, jobId, "quotes");
    await batchDeleteQuotes(db, tenantId);

    // Phase 10: Clients and webhooks
    await updatePhase(db, jobId, "clients");
    await batchDelete(db, schema.clients, "tenantId", tenantId);
    await batchDelete(db, schema.webhookDeliveries, "tenantId", tenantId);

    // Phase 11: Leads (the big one)
    await updatePhase(db, jobId, "leads");
    const deletedLeads = await batchDeleteLeads(db, tenantId);

    // Complete
    await db
      .update(schema.platformPurgeJobs)
      .set({
        status: "completed",
        deletedLeads,
        deletedConversations: job.totalConversations ?? 0,
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
      metadata: { jobId, deletedLeads: String(deletedLeads) },
      createdAt: new Date(),
    });
  } catch (error) {
    await db
      .update(schema.platformPurgeJobs)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : "Erro desconhecido",
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
  }
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

async function batchDelete(
  db: ReturnType<typeof getDatabase>,
  table: { tenantId: any },
  column: string,
  tenantId: string,
): Promise<number> {
  let totalDeleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Drizzle doesn't support LIMIT on delete directly for all drivers,
    // so we use a subquery approach with ctid
    const result = await db.execute(sql`
      DELETE FROM ${table}
      WHERE ctid IN (
        SELECT ctid FROM ${table}
        WHERE ${sql`${(table as any).tenantId}`} = ${tenantId}
        LIMIT ${BATCH_SIZE}
      )
    `);
    const deleted = (result as any).rowCount ?? 0;
    totalDeleted += deleted;
    if (deleted < BATCH_SIZE) break;
    await yieldToEventLoop();
  }
  return totalDeleted;
}

async function batchDeleteConversations(
  db: ReturnType<typeof getDatabase>,
  jobId: string,
  tenantId: string,
): Promise<void> {
  let totalDeleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await db.execute(sql`
      DELETE FROM ${schema.aiConversations}
      WHERE ctid IN (
        SELECT ctid FROM ${schema.aiConversations}
        WHERE ${schema.aiConversations.tenantId} = ${tenantId}
        LIMIT ${BATCH_SIZE}
      )
    `);
    const deleted = (result as any).rowCount ?? 0;
    totalDeleted += deleted;
    // Update progress
    await db
      .update(schema.platformPurgeJobs)
      .set({ deletedConversations: totalDeleted, updatedAt: new Date() })
      .where(eq(schema.platformPurgeJobs.id, jobId));
    if (deleted < BATCH_SIZE) break;
    await yieldToEventLoop();
  }
}

async function batchDeleteInteractions(
  db: ReturnType<typeof getDatabase>,
  tenantId: string,
): Promise<void> {
  // Get lead IDs in batches and delete interactions for each batch
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const leadIds = await db.execute(sql`
      SELECT id FROM ${schema.leads}
      WHERE ${schema.leads.tenantId} = ${tenantId}
      LIMIT ${BATCH_SIZE}
    `);
    const ids = (leadIds as any).rows?.map((r: any) => r.id) ?? [];
    if (ids.length === 0) break;

    await db
      .delete(schema.leadInteractions)
      .where(inArray(schema.leadInteractions.leadId, ids));

    if (ids.length < BATCH_SIZE) break;
    await yieldToEventLoop();
  }
}

async function batchDeleteMarketing(
  db: ReturnType<typeof getDatabase>,
  tenantId: string,
): Promise<void> {
  // Delete import results in batches
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const importIds = await db.execute(sql`
      SELECT id FROM ${schema.marketingImports}
      WHERE ${schema.marketingImports.tenantId} = ${tenantId}
      LIMIT ${BATCH_SIZE}
    `);
    const ids = (importIds as any).rows?.map((r: any) => r.id) ?? [];
    if (ids.length === 0) break;

    await db
      .delete(schema.marketingImportResults)
      .where(inArray(schema.marketingImportResults.importId, ids));

    if (ids.length < BATCH_SIZE) break;
    await yieldToEventLoop();
  }
  await batchDelete(db, schema.marketingImports, "tenantId", tenantId);
}

async function batchDeleteTasks(
  db: ReturnType<typeof getDatabase>,
  tenantId: string,
): Promise<void> {
  // Delete task assignees in batches
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const taskIds = await db.execute(sql`
      SELECT id FROM ${schema.leadTasks}
      WHERE ${schema.leadTasks.tenantId} = ${tenantId}
      LIMIT ${BATCH_SIZE}
    `);
    const ids = (taskIds as any).rows?.map((r: any) => r.id) ?? [];
    if (ids.length === 0) break;

    await db
      .delete(schema.leadTaskAssignees)
      .where(inArray(schema.leadTaskAssignees.taskId, ids));

    if (ids.length < BATCH_SIZE) break;
    await yieldToEventLoop();
  }
  await batchDelete(db, schema.leadTasks, "tenantId", tenantId);
}

async function batchDeleteQuotes(
  db: ReturnType<typeof getDatabase>,
  tenantId: string,
): Promise<void> {
  // Delete quote items in batches
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const quoteIds = await db.execute(sql`
      SELECT id FROM ${schema.quotes}
      WHERE ${schema.quotes.tenantId} = ${tenantId}
      LIMIT ${BATCH_SIZE}
    `);
    const ids = (quoteIds as any).rows?.map((r: any) => r.id) ?? [];
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
  await batchDelete(db, schema.quotes, "tenantId", tenantId);
}

async function batchDeleteLeads(
  db: ReturnType<typeof getDatabase>,
  tenantId: string,
): Promise<number> {
  let totalDeleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await db.execute(sql`
      DELETE FROM ${schema.leads}
      WHERE ctid IN (
        SELECT ctid FROM ${schema.leads}
        WHERE ${schema.leads.tenantId} = ${tenantId}
        LIMIT ${BATCH_SIZE}
      )
    `);
    const deleted = (result as any).rowCount ?? 0;
    totalDeleted += deleted;
    if (deleted < BATCH_SIZE) break;
    await yieldToEventLoop();
  }
  return totalDeleted;
}
