import "server-only";

import { and, count, eq, gt, isNull, lte, or } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { getDatabase, schema } from "@/shared/db";

/**
 * Cached wrappers for the /leads page's reference data — branches, brokers,
 * queues, SLA settings, plans, and the "on duty now" lookup. None of these
 * depend on page/sort/search/filter, but page.tsx re-ran all of them on
 * every pagination/filter/sort interaction because the whole Server
 * Component re-executes on any searchParams change (force-dynamic route).
 * Caching them (same pattern as features/global-catalog/queries.ts) means
 * only the actual leads count+list query stays uncached/fresh on every
 * interaction — everything here tolerates a short staleness window.
 */

export const getCachedLeadsBranches = (tenantId: string) =>
  unstable_cache(
    async () => {
      const db = getDatabase();
      return db
        .select({ id: schema.branches.id, name: schema.branches.name })
        .from(schema.branches)
        .where(eq(schema.branches.tenantId, tenantId));
    },
    ["leads-ref-branches", tenantId],
    { revalidate: 60 },
  )();

export const getCachedPausedBranchCount = (tenantId: string) =>
  unstable_cache(
    async () => {
      const db = getDatabase();
      const rows = await db
        .select({ count: count() })
        .from(schema.branches)
        .where(and(eq(schema.branches.tenantId, tenantId), eq(schema.branches.acceptingLeads, false)));
      return Number(rows[0]?.count ?? 0);
    },
    ["leads-ref-paused-branch-count", tenantId],
    { revalidate: 60 },
  )();

export const getCachedSlaSettings = (tenantId: string) =>
  unstable_cache(
    async () => {
      const db = getDatabase();
      const rows = await db
        .select({
          slaFirstContactMinutes: schema.tenants.slaFirstContactMinutes,
          slaStagnantDays: schema.tenants.slaStagnantDays,
        })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId));
      return rows[0] ?? { slaFirstContactMinutes: "15", slaStagnantDays: "3" };
    },
    ["leads-ref-sla-settings", tenantId],
    { revalidate: 60 },
  )();

export const getCachedLegacyPlans = (tenantId: string) =>
  unstable_cache(
    async () => {
      const db = getDatabase();
      return db
        .select({ id: schema.carrierPlans.id, name: schema.carrierPlans.name, carrierName: schema.carriers.name })
        .from(schema.carrierPlans)
        .innerJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
        .where(
          and(
            eq(schema.carrierPlans.tenantId, tenantId),
            eq(schema.carrierPlans.active, true),
            eq(schema.carriers.status, "active"),
          ),
        )
        .orderBy(schema.carriers.name, schema.carrierPlans.name);
    },
    ["leads-ref-legacy-plans", tenantId],
    { revalidate: 60 },
  )();

export const getCachedActiveQueues = (tenantId: string) =>
  unstable_cache(
    async () => {
      const db = getDatabase();
      return db
        .select({
          id: schema.leadQueues.id,
          name: schema.leadQueues.name,
          branchId: schema.leadQueues.branchId,
          assignmentMode: schema.leadQueues.assignmentMode,
        })
        .from(schema.leadQueues)
        .where(and(eq(schema.leadQueues.tenantId, tenantId), eq(schema.leadQueues.status, "active"), isNull(schema.leadQueues.deletedAt)));
    },
    ["leads-ref-active-queues", tenantId],
    { revalidate: 30 },
  )();

// role/branchId change the query shape (manager sees only their branch), so
// both are part of the cache key alongside tenantId.
export const getCachedLeadsBrokers = (tenantId: string, role: string, branchId: string | null) =>
  unstable_cache(
    async () => {
      if (role !== "manager" && role !== "director") return [];
      const db = getDatabase();
      return db
        .select({ id: schema.user.id, name: schema.user.name, branchId: schema.tenantMemberships.branchId })
        .from(schema.tenantMemberships)
        .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
        .where(
          and(
            eq(schema.tenantMemberships.tenantId, tenantId),
            eq(schema.tenantMemberships.role, "broker"),
            eq(schema.tenantMemberships.jobTitle, "broker"),
            eq(schema.tenantMemberships.status, "active"),
            eq(schema.user.active, true),
            role === "manager" && branchId ? eq(schema.tenantMemberships.branchId, branchId) : undefined,
          ),
        );
    },
    ["leads-ref-brokers", tenantId, role, branchId ?? "none"],
    { revalidate: 30 },
  )();

// "Who's on duty right now" — naturally time-dependent, but a UI badge
// tolerates up to ~30s of staleness fine, so time-of-day is NOT part of the
// cache key (that would make every call a miss); the revalidate window
// handles freshness instead.
export const getCachedActiveDutyAssignments = (
  tenantId: string,
  dutyLocal: { weekday: number; time: string },
  dutyNow: Date,
) =>
  unstable_cache(
    async () => {
      const db = getDatabase();
      return db
        .select({ branchId: schema.dutyRosterAssignments.branchId, brokerId: schema.dutyRosterAssignments.brokerId })
        .from(schema.dutyRosterAssignments)
        .innerJoin(schema.unitDutySchedules, eq(schema.dutyRosterAssignments.scheduleId, schema.unitDutySchedules.id))
        .where(
          and(
            eq(schema.dutyRosterAssignments.tenantId, tenantId),
            eq(schema.dutyRosterAssignments.status, "active"),
            eq(schema.unitDutySchedules.tenantId, tenantId),
            eq(schema.unitDutySchedules.status, "active"),
            or(isNull(schema.unitDutySchedules.branchId), eq(schema.dutyRosterAssignments.branchId, schema.unitDutySchedules.branchId)),
            eq(schema.unitDutySchedules.dayOfWeek, dutyLocal.weekday),
            lte(schema.unitDutySchedules.startsAt, dutyLocal.time),
            gt(schema.unitDutySchedules.endsAt, dutyLocal.time),
            lte(schema.unitDutySchedules.validFrom, dutyNow),
            or(isNull(schema.unitDutySchedules.validUntil), gt(schema.unitDutySchedules.validUntil, dutyNow)),
            eq(schema.dutyRosterAssignments.dayOfWeek, dutyLocal.weekday),
            lte(schema.dutyRosterAssignments.startsAt, dutyLocal.time),
            gt(schema.dutyRosterAssignments.endsAt, dutyLocal.time),
            lte(schema.dutyRosterAssignments.validFrom, dutyNow),
            or(isNull(schema.dutyRosterAssignments.validUntil), gt(schema.dutyRosterAssignments.validUntil, dutyNow)),
          ),
        );
    },
    ["leads-ref-active-duty", tenantId],
    { revalidate: 30 },
  )();

// NOTE: leads.count / leads.list / leads.unassigned_count / leads.unassigned_list
// / leads.qualifying_list are intentionally NOT cached here — their WHERE
// clauses depend on the active search/status/branch/tipo/origem/qualification
// /corretor/period/eligibleCampaigns filters, so caching them by tenantId
// alone would return stale or outright wrong results for the filters the
// user actually has applied. They stay in page.tsx, uncached.
