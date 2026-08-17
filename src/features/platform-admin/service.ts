import "server-only";

import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getDatabase, schema } from "@/shared/db";

const cnpjPattern = /^\d{14}$/;

export class TenantCnpjAlreadyExistsError extends Error {
  constructor() {
    super("Já existe uma empresa cadastrada com este CNPJ.");
    this.name = "TenantCnpjAlreadyExistsError";
  }
}

const tenantInput = z.object({
  name: z.string().trim().min(2).max(120),
  legalName: z.string().trim().max(160).optional(),
  cnpj: z.preprocess(
    (value) => typeof value === "string" ? value : "",
    z.string().trim().transform((value) => value.replace(/\D/g, "")).refine((value) => cnpjPattern.test(value), "CNPJ deve conter 14 dígitos."),
  ),
  subscriptionPlan: z.string().trim().min(2).max(60),
}).transform((input) => ({
  ...input,
  legalName: input.legalName && input.legalName.length >= 2 ? input.legalName : input.name,
}));

const accessInput = z.object({
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  role: z.enum(["director", "manager", "broker"]),
});

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function writeAudit(action: string, targetType: string, targetId: string, metadata?: Record<string, string>) {
  const admin = await getRequiredPlatformAdmin();
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: randomUUID(), actorUserId: admin.userId, action, targetType, targetId, metadata,
  });
}

export async function getPlatformTenants() {
  await getRequiredPlatformAdmin();
  return getDatabase().select().from(schema.tenants).orderBy(schema.tenants.createdAt);
}

export async function getPlatformTenant(tenantId: string) {
  await getRequiredPlatformAdmin();
  const [tenant] = await getDatabase().select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)).limit(1);
  return tenant ?? null;
}

export async function getTenantMembers(tenantId: string) {
  await getRequiredPlatformAdmin();
  return getDatabase().select({
    id: schema.tenantMemberships.id,
    name: schema.user.name,
    email: schema.user.email,
    role: schema.tenantMemberships.role,
    status: schema.tenantMemberships.status,
    branchName: schema.branches.name,
  }).from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .leftJoin(schema.branches, eq(schema.tenantMemberships.branchId, schema.branches.id))
    .where(eq(schema.tenantMemberships.tenantId, tenantId));
}

export async function getTenantBranches(tenantId: string) {
  await getRequiredPlatformAdmin();
  return getDatabase().select().from(schema.branches).where(eq(schema.branches.tenantId, tenantId));
}

export async function createPlatformTenant(rawInput: unknown) {
  const input = tenantInput.parse(rawInput);
  await getRequiredPlatformAdmin();
  const db = getDatabase();
  const [existingCnpj] = await db
    .select({ id: schema.tenants.id })
    .from(schema.tenants)
    .where(eq(schema.tenants.cnpj, input.cnpj))
    .limit(1);
  if (existingCnpj) throw new TenantCnpjAlreadyExistsError();

  const baseSlug = slugify(input.name);
  let slug = baseSlug;
  let suffix = 2;
  while ((await db.select({ id: schema.tenants.id }).from(schema.tenants).where(eq(schema.tenants.slug, slug)).limit(1)).length) slug = `${baseSlug}-${suffix++}`;
  const tenantId = randomUUID();
  const branchId = randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.tenants).values({ id: tenantId, name: input.name, slug, legalName: input.legalName, cnpj: input.cnpj, subscriptionPlan: input.subscriptionPlan, status: "active" });
      await tx.insert(schema.branches).values({ id: branchId, tenantId, name: "Matriz", status: "active" });
    });
  } catch (error) {
    const cause = error as { cause?: { code?: string; constraint?: string } };
    if (cause.cause?.code === "23505" && cause.cause.constraint === "tenants_cnpj_unique") {
      throw new TenantCnpjAlreadyExistsError();
    }
    throw error;
  }
  await writeAudit("tenant.created", "tenant", tenantId, { slug });
  return tenantId;
}

export async function setPlatformTenantStatus(tenantId: string, status: "active" | "inactive") {
  await getRequiredPlatformAdmin();
  await getDatabase().update(schema.tenants).set({ status, updatedAt: new Date() }).where(eq(schema.tenants.id, tenantId));
  await writeAudit("tenant.status_changed", "tenant", tenantId, { status });

  // Revogar todas as sessões quando o tenant for suspenso
  if (status === "inactive") {
    const { revokeTenantSessions } = await import("./session-revocation");
    await revokeTenantSessions(tenantId, "tenant_suspended");
  }
}

export async function createTenantAccess(rawInput: unknown) {
  const input = accessInput.parse(rawInput);
  await getRequiredPlatformAdmin();
  const db = getDatabase();
  const [branch] = await db.select().from(schema.branches).where(and(eq(schema.branches.id, input.branchId), eq(schema.branches.tenantId, input.tenantId))).limit(1);
  if (!branch) throw new Error("A filial selecionada não pertence a esta corretora.");
  const [existingUser] = await db.select().from(schema.user).where(eq(schema.user.email, input.email)).limit(1);
  if (existingUser) throw new Error("Já existe uma identidade com este e-mail.");
  const userId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(schema.user).values({ id: userId, name: input.name, email: input.email, emailVerified: true, active: true });
    await tx.insert(schema.account).values({ id: randomUUID(), userId, providerId: "credential", accountId: userId, password: await hashPassword(input.password) });
    await tx.insert(schema.tenantMemberships).values({ id: randomUUID(), tenantId: input.tenantId, userId, branchId: input.branchId, role: input.role, status: "active" });
  });
  await writeAudit("tenant_access.created", "tenant_membership", userId, { tenantId: input.tenantId, role: input.role });
}

export async function getPlatformAuditLogs() {
  await getRequiredPlatformAdmin();
  const db = getDatabase();
  return db.select({
    id: schema.platformAuditLogs.id,
    action: schema.platformAuditLogs.action,
    targetType: schema.platformAuditLogs.targetType,
    targetId: schema.platformAuditLogs.targetId,
    metadata: schema.platformAuditLogs.metadata,
    createdAt: schema.platformAuditLogs.createdAt,
    actorName: schema.user.name,
    actorEmail: schema.user.email,
  }).from(schema.platformAuditLogs)
    .innerJoin(schema.user, eq(schema.platformAuditLogs.actorUserId, schema.user.id))
    .orderBy(schema.platformAuditLogs.createdAt);
}

export async function getTenantAuditLogs() {
  await getRequiredPlatformAdmin();
  const db = getDatabase();
  return db.select({
    id: schema.auditLogs.id,
    userId: schema.auditLogs.userId,
    entidade: schema.auditLogs.entidade,
    entidadeId: schema.auditLogs.entidadeId,
    acao: schema.auditLogs.acao,
    createdAt: schema.auditLogs.createdAt,
    userName: schema.user.name,
    userEmail: schema.user.email,
  }).from(schema.auditLogs)
    .innerJoin(schema.user, eq(schema.auditLogs.userId, schema.user.id))
    .orderBy(schema.auditLogs.createdAt);
}

export async function getActiveSessions() {
  await getRequiredPlatformAdmin();
  const db = getDatabase();
  return db.select({
    id: schema.session.id,
    ipAddress: schema.session.ipAddress,
    userAgent: schema.session.userAgent,
    expiresAt: schema.session.expiresAt,
    createdAt: schema.session.createdAt,
    userName: schema.user.name,
    userEmail: schema.user.email,
    userId: schema.user.id,
  }).from(schema.session)
    .innerJoin(schema.user, eq(schema.session.userId, schema.user.id))
    .orderBy(schema.session.createdAt);
}

export async function terminateSession(sessionId: string) {
  await getRequiredPlatformAdmin();
  const db = getDatabase();
  await db.delete(schema.session).where(eq(schema.session.id, sessionId));
  await writeAudit("session.terminated", "session", sessionId);
}

export async function getLossRateAlerts() {
  await getRequiredPlatformAdmin();
  const db = getDatabase();

  const brokersLeads = await db.select({
    corretorId: schema.leads.corretorId,
    corretorNome: schema.user.name,
    corretorEmail: schema.user.email,
    total: sql<number>`count(${schema.leads.id})::int`,
    lost: sql<number>`count(case when ${schema.leads.status} = 'lost' then 1 end)::int`,
  }).from(schema.leads)
    .innerJoin(schema.user, eq(schema.leads.corretorId, schema.user.id))
    .groupBy(schema.leads.corretorId, schema.user.name, schema.user.email);

  return brokersLeads
    .map((broker) => {
      const rate = broker.total > 0 ? (broker.lost / broker.total) * 100 : 0;
      return {
        ...broker,
        rate: Math.round(rate),
      };
    })
    .filter((broker) => broker.rate >= 75 && broker.total >= 3); // Minimum 3 leads to avoid noise
}

export async function purgeUserLGPD(userId: string) {
  await getRequiredPlatformAdmin();
  const db = getDatabase();
  await db.transaction(async (tx) => {
    // Purge session
    await tx.delete(schema.session).where(eq(schema.session.userId, userId));
    // Purge account
    await tx.delete(schema.account).where(eq(schema.account.userId, userId));
    // Purge tenant membership
    await tx.delete(schema.tenantMemberships).where(eq(schema.tenantMemberships.userId, userId));
    // Update user active status and nullify details
    await tx.update(schema.user).set({
      name: "LGPD EXCLUÍDO",
      email: `lgpd-deleted-${randomUUID()}@ancoracorretora.com.br`,
      active: false,
      twoFactorEnabled: false,
    }).where(eq(schema.user.id, userId));
  });
  await writeAudit("lgpd.user_purged", "user", userId);
}

export async function purgeTenantOperationalData(tenantId: string) {
  const admin = await getRequiredPlatformAdmin();
  const db = getDatabase();
  const now = new Date();

  return await db.transaction(async (tx) => {
    // Counts for audit record before purging
    const [{ count: leadsCount }] = await tx
      .select({ count: count() })
      .from(schema.leads)
      .where(eq(schema.leads.tenantId, tenantId));

    const [{ count: conversationsCount }] = await tx
      .select({ count: count() })
      .from(schema.aiConversations)
      .where(eq(schema.aiConversations.tenantId, tenantId));

    // 1. Delete dependent outboxes and cadence runs
    await tx.delete(schema.wahaDeliveryOutbox).where(eq(schema.wahaDeliveryOutbox.tenantId, tenantId));
    await tx.delete(schema.wahaCadenceRuns).where(eq(schema.wahaCadenceRuns.tenantId, tenantId));
    await tx.delete(schema.leadEffectOutbox).where(eq(schema.leadEffectOutbox.tenantId, tenantId));
    await tx.delete(schema.leadDistributionJobs).where(eq(schema.leadDistributionJobs.tenantId, tenantId));
    await tx.delete(schema.leadDistributionEvents).where(eq(schema.leadDistributionEvents.tenantId, tenantId));

    // 2. Delete AI logs, events, sessions, and messages
    await tx.delete(schema.aiAttendanceLogs).where(eq(schema.aiAttendanceLogs.tenantId, tenantId));
    await tx.delete(schema.aiQuickReplyEvents).where(eq(schema.aiQuickReplyEvents.tenantId, tenantId));
    await tx.delete(schema.whatsappMessages).where(eq(schema.whatsappMessages.tenantId, tenantId));
    await tx.delete(schema.aiConversations).where(eq(schema.aiConversations.tenantId, tenantId));
    await tx.delete(schema.aiQualificationSessions).where(eq(schema.aiQualificationSessions.tenantId, tenantId));
    await tx.delete(schema.agentTrainingSimulations).where(eq(schema.agentTrainingSimulations.tenantId, tenantId));

    // 3. Delete notifications, feedbacks, attempts
    await tx.delete(schema.notifications).where(eq(schema.notifications.tenantId, tenantId));
    await tx.delete(schema.leadFeedbacks).where(eq(schema.leadFeedbacks.tenantId, tenantId));
    await tx.delete(schema.leadAssignmentAttempts).where(eq(schema.leadAssignmentAttempts.tenantId, tenantId));

    // 4. Delete lead interactions and beneficiaries
    const tenantLeadsForInteractions = await tx
      .select({ id: schema.leads.id })
      .from(schema.leads)
      .where(eq(schema.leads.tenantId, tenantId));
    if (tenantLeadsForInteractions.length > 0) {
      await tx.delete(schema.leadInteractions).where(
        inArray(schema.leadInteractions.leadId, tenantLeadsForInteractions.map((l) => l.id))
      );
    }
    await tx.delete(schema.leadBeneficiaries).where(eq(schema.leadBeneficiaries.tenantId, tenantId));

    // 5. Delete lead offers, checklist, documents
    await tx.delete(schema.leadOffers).where(eq(schema.leadOffers.tenantId, tenantId));
    await tx.delete(schema.leadDocumentChecklist).where(eq(schema.leadDocumentChecklist.tenantId, tenantId));
    await tx.delete(schema.leadDocuments).where(eq(schema.leadDocuments.tenantId, tenantId));

    // 6. Delete sales & commission schedules
    await tx.delete(schema.sales).where(eq(schema.sales.tenantId, tenantId));
    await tx.delete(schema.commissionSchedule).where(eq(schema.commissionSchedule.tenantId, tenantId));

    // 7. Delete marketing import results & batches
    const importBatches = await tx
      .select({ id: schema.marketingImports.id })
      .from(schema.marketingImports)
      .where(eq(schema.marketingImports.tenantId, tenantId));
    if (importBatches.length > 0) {
      await tx.delete(schema.marketingImportResults).where(
        inArray(schema.marketingImportResults.importId, importBatches.map((b) => b.id))
      );
    }
    await tx.delete(schema.marketingImports).where(eq(schema.marketingImports.tenantId, tenantId));

    // 8. Delete outbound messages & tasks
    await tx.delete(schema.whatsappOutboundMessages).where(eq(schema.whatsappOutboundMessages.tenantId, tenantId));

    const tenantTaskIds = await tx
      .select({ id: schema.leadTasks.id })
      .from(schema.leadTasks)
      .where(eq(schema.leadTasks.tenantId, tenantId));
    if (tenantTaskIds.length > 0) {
      await tx.delete(schema.leadTaskAssignees).where(
        inArray(schema.leadTaskAssignees.taskId, tenantTaskIds.map((t) => t.id))
      );
    }
    await tx.delete(schema.leadTasks).where(eq(schema.leadTasks.tenantId, tenantId));

    // 9. Delete quotes and quote line items
    const tenantQuoteIds = await tx
      .select({ id: schema.quotes.id })
      .from(schema.quotes)
      .where(eq(schema.quotes.tenantId, tenantId));
    if (tenantQuoteIds.length > 0) {
      const qIds = tenantQuoteIds.map((q) => q.id);
      await tx.delete(schema.quoteLineItems).where(inArray(schema.quoteLineItems.quoteId, qIds));
      await tx.delete(schema.quoteItems).where(inArray(schema.quoteItems.quoteId, qIds));
    }
    await tx.delete(schema.quotes).where(eq(schema.quotes.tenantId, tenantId));

    // 10. Delete clients & webhook deliveries
    await tx.delete(schema.clients).where(eq(schema.clients.tenantId, tenantId));
    await tx.delete(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.tenantId, tenantId));

    // 11. Delete all leads
    await tx.delete(schema.leads).where(eq(schema.leads.tenantId, tenantId));

    // 12. Record audit log
    await tx.insert(schema.platformAuditLogs).values({
      id: randomUUID(),
      actorUserId: admin.userId,
      action: "tenant.operational_reset",
      targetType: "tenant",
      targetId: tenantId,
      metadata: {
        deletedLeadsCount: Number(leadsCount),
        deletedConversationsCount: Number(conversationsCount),
        resetAt: now.toISOString(),
      },
      createdAt: now,
    });

    return {
      deletedLeadsCount: Number(leadsCount),
      deletedConversationsCount: Number(conversationsCount),
    };
  });
}
