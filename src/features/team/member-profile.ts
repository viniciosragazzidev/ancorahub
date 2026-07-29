import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

const memberUserIdSchema = z.string().uuid();

type Viewer = { role: "director" | "manager" | "broker"; branchId: string | null };

/** A manager can inspect only a member whose membership belongs to the same unit. */
export function canViewTeamMemberProfile(viewer: Viewer, memberBranchId: string | null) {
  if (viewer.role === "director") return true;
  return viewer.role === "manager" && viewer.branchId !== null && viewer.branchId === memberBranchId;
}

export async function isTeamMemberProfileEnabled() {
  return (await getSystemSetting("feature_team_member_profile_enabled")) !== "false";
}

export async function getTeamMemberProfile(memberUserId: string) {
  const parsedUserId = memberUserIdSchema.safeParse(memberUserId);
  if (!parsedUserId.success) return null;

  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") return null;
  if (!(await isTeamMemberProfileEnabled())) return null;

  const db = getDatabase();
  const managerScope = context.role === "manager"
    ? context.branchId ? eq(schema.tenantMemberships.branchId, context.branchId) : sql`false`
    : undefined;
  const [member] = await db.select({
    userId: schema.user.id,
    name: schema.user.name,
    email: schema.user.email,
    image: schema.user.image,
    userStatus: schema.user.status,
    role: schema.tenantMemberships.role,
    jobTitle: schema.tenantMemberships.jobTitle,
    availabilityStatus: schema.tenantMemberships.availabilityStatus,
    membershipStatus: schema.tenantMemberships.status,
    branchId: schema.tenantMemberships.branchId,
    branchName: schema.branches.name,
    customRoleName: schema.customRoles.name,
    joinedAt: schema.tenantMemberships.createdAt,
    brokerCode: schema.brokerProfiles.internalCode,
    brokerPhone: schema.brokerProfiles.phone,
    brokerLifecycleStatus: schema.brokerProfiles.lifecycleStatus,
    activatedAt: schema.brokerProfiles.activatedAt,
  })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .leftJoin(schema.branches, eq(schema.tenantMemberships.branchId, schema.branches.id))
    .leftJoin(schema.customRoles, eq(schema.tenantMemberships.customRoleId, schema.customRoles.id))
    .leftJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.userId, schema.user.id), eq(schema.brokerProfiles.tenantId, context.tenantId)))
    .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.user.id, parsedUserId.data), managerScope))
    .limit(1);
  if (!member || !canViewTeamMemberProfile(context, member.branchId)) return null;

  const leadScope = and(
    eq(schema.leads.tenantId, context.tenantId),
    eq(schema.leads.corretorId, member.userId),
    context.role === "manager" && context.branchId ? eq(schema.leads.branchId, context.branchId) : undefined,
  );
  const salesScope = and(
    eq(schema.sales.tenantId, context.tenantId),
    eq(schema.sales.brokerId, member.userId),
    context.role === "manager" && context.branchId ? eq(schema.leads.branchId, context.branchId) : undefined,
  );
  const taskScope = and(
    eq(schema.leadTasks.tenantId, context.tenantId),
    eq(schema.leadTasks.assignedTo, member.userId),
    context.role === "manager" && context.branchId ? eq(schema.leads.branchId, context.branchId) : undefined,
  );
  const quoteScope = and(
    eq(schema.quotes.tenantId, context.tenantId),
    eq(schema.quotes.createdBy, member.userId),
    context.role === "manager" && context.branchId ? eq(schema.leads.branchId, context.branchId) : undefined,
  );
  const interactionScope = and(
    eq(schema.leads.tenantId, context.tenantId),
    eq(schema.leadInteractions.userId, member.userId),
    context.role === "manager" && context.branchId ? eq(schema.leads.branchId, context.branchId) : undefined,
  );
  const redistributionScope = and(
    eq(schema.leadDistributionEvents.tenantId, context.tenantId),
    eq(schema.leadDistributionEvents.previousOwnerId, member.userId),
    or(ne(schema.leadDistributionEvents.newOwnerId, member.userId), isNull(schema.leadDistributionEvents.newOwnerId)),
    context.role === "manager" && context.branchId ? eq(schema.leads.branchId, context.branchId) : undefined,
  );

  const [leadMetrics, salesMetrics, taskMetrics, quoteMetrics, interactionMetrics, redistributionMetrics, recentLeads, recentRedistributions] = await Promise.all([
    db.select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${schema.leads.status} in ('distributed', 'in_contact', 'quote_sent', 'negotiation', 'documentation_pending', 'under_analysis'))::int`,
      qualified: sql<number>`count(*) filter (where ${schema.leads.qualificationStatus} in ('qualified', 'hot', 'warm'))::int`,
      lost: sql<number>`count(*) filter (where ${schema.leads.status} = 'lost')::int`,
      withoutFirstContact: sql<number>`count(*) filter (where ${schema.leads.firstContactAt} is null and ${schema.leads.status} not in ('lost', 'converted'))::int`,
      converted: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')::int`,
    }).from(schema.leads).where(leadScope),
    db.select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${schema.sales.status} = 'active')::int`,
      cancelled: sql<number>`count(*) filter (where ${schema.sales.status} <> 'active')::int`,
      volume: sql<string>`coalesce(sum(${schema.sales.saleValue}), 0)::text`,
    }).from(schema.sales).innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id)).where(salesScope),
    db.select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${schema.leadTasks.completedAt} is not null)::int`,
      overdue: sql<number>`count(*) filter (where ${schema.leadTasks.completedAt} is null and ${schema.leadTasks.dueAt} < now())::int`,
      open: sql<number>`count(*) filter (where ${schema.leadTasks.completedAt} is null)::int`,
    }).from(schema.leadTasks).innerJoin(schema.leads, eq(schema.leadTasks.leadId, schema.leads.id)).where(taskScope),
    db.select({
      total: sql<number>`count(*)::int`,
      sent: sql<number>`count(*) filter (where ${schema.quotes.status} in ('shared', 'sent', 'accepted'))::int`,
      accepted: sql<number>`count(*) filter (where ${schema.quotes.status} = 'accepted')::int`,
    }).from(schema.quotes).innerJoin(schema.leads, eq(schema.quotes.leadId, schema.leads.id)).where(quoteScope),
    db.select({ total: sql<number>`count(*)::int` }).from(schema.leadInteractions).innerJoin(schema.leads, eq(schema.leadInteractions.leadId, schema.leads.id)).where(interactionScope),
    db.select({
      total: sql<number>`count(*)::int`,
      withoutFirstContact: sql<number>`count(*) filter (where ${schema.leads.firstContactAt} is null)::int`,
    }).from(schema.leadDistributionEvents).innerJoin(schema.leads, eq(schema.leadDistributionEvents.leadId, schema.leads.id)).where(redistributionScope),
    db.select({ id: schema.leads.id, name: schema.leads.nome, status: schema.leads.status, assignedAt: schema.leads.assignedAt, firstContactAt: schema.leads.firstContactAt, createdAt: schema.leads.createdAt })
      .from(schema.leads).where(leadScope).orderBy(desc(schema.leads.updatedAt)).limit(6),
    db.select({ id: schema.leadDistributionEvents.id, leadName: schema.leads.nome, action: schema.leadDistributionEvents.action, reason: schema.leadDistributionEvents.reason, createdAt: schema.leadDistributionEvents.createdAt })
      .from(schema.leadDistributionEvents).innerJoin(schema.leads, eq(schema.leadDistributionEvents.leadId, schema.leads.id)).where(redistributionScope).orderBy(desc(schema.leadDistributionEvents.createdAt)).limit(6),
  ]);

  await db.insert(schema.auditLogs).values({
    id: randomUUID(), userId: context.userId, entidade: "team_member_profile", entidadeId: member.userId, acao: "team_member_profile.viewed",
  });

  return {
    member,
    metrics: {
      leads: leadMetrics[0] ?? { total: 0, active: 0, qualified: 0, lost: 0, withoutFirstContact: 0, converted: 0 },
      sales: salesMetrics[0] ?? { total: 0, active: 0, cancelled: 0, volume: "0" },
      tasks: taskMetrics[0] ?? { total: 0, completed: 0, overdue: 0, open: 0 },
      quotes: quoteMetrics[0] ?? { total: 0, sent: 0, accepted: 0 },
      interactions: interactionMetrics[0]?.total ?? 0,
      redistributions: redistributionMetrics[0]?.total ?? 0,
      redistributionsWithoutFirstContact: redistributionMetrics[0]?.withoutFirstContact ?? 0,
    },
    recentLeads,
    recentRedistributions,
  };
}
