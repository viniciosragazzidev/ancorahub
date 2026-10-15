import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { buildTeamInternal, buildTeamLeaderboard, buildUnitLeaderboard, rankBrokers, type BrokerStanding, type TeamProfile } from "./leaderboard";
import { journeyWeek, shiftJourneyDay } from "./journey-periods";
import { journeyUserIdSchema } from "./journey-validation";
import type { BrokerWeekSummary } from "./journey-types";
import { journeyRankingTag } from "./journey-cache";

/** Tenant and SP week are cache arguments; no request cookies enter this scope. */
async function readStandings(tenantId: string, weekStart: string, weekEnd: string) {
  const db = getDatabase();
  const previousStart = shiftJourneyDay(weekStart, -7);
  const rows = await db.execute<BrokerStanding & { totalPoints: number }>(sql`
    with week_points as (
      select broker_id, sum(points) filter (where period_day>=${weekStart}::date)::int as current,
        sum(points) filter (where period_day<${weekStart}::date)::int as previous
      from engagement_point_events where tenant_id=${tenantId} and reversed_at is null
        and period_day>=${previousStart}::date and period_day<${weekEnd}::date group by broker_id
    ), career as (
      select broker_id,sum(points)::int as total from engagement_point_events where tenant_id=${tenantId} and reversed_at is null group by broker_id
    ) select m.user_id as "brokerId", u.name, u.image as "imageUrl", m.branch_id as "branchId", m.supervisor_id as "supervisorId",
      m.ranking_opt_out as "optedOut", coalesce(p.current,0)::int as points, coalesce(p.previous,0)::int as "previousPoints", coalesce(c.total,0)::int as "totalPoints"
      from tenant_memberships m join "user" u on u.id=m.user_id left join week_points p on p.broker_id=m.user_id left join career c on c.broker_id=m.user_id
      where m.tenant_id=${tenantId} and m.role='broker' and m.status='active'`).catch(() => []);
  return rows.map((r) => ({ ...r, points: Number(r.points), previousPoints: Number(r.previousPoints), totalPoints: Number(r.totalPoints) }));
}
function standings(tenantId: string, weekStart: string, weekEnd: string) {
  return unstable_cache(readStandings, ["journey-standings-v1"], { revalidate: 60, tags: [journeyRankingTag(tenantId)] })(tenantId, weekStart, weekEnd);
}

const teamProfiles = unstable_cache(async (tenantId: string): Promise<TeamProfile[]> => getDatabase().select({
  supervisorId: schema.supervisorTeams.supervisorId, name: schema.supervisorTeams.name, imageUrl: schema.supervisorTeams.imageUrl, branchId: schema.supervisorTeams.branchId,
}).from(schema.supervisorTeams).innerJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.tenantId, tenantId), eq(schema.tenantMemberships.userId, schema.supervisorTeams.supervisorId), eq(schema.tenantMemberships.role, "supervisor"), eq(schema.tenantMemberships.status, "active")))
  .where(eq(schema.supervisorTeams.tenantId, tenantId)).catch(() => []), ["journey-team-profiles-v1"], { revalidate: 60 });

export async function brokerWeek(tenantId: string, brokerId: string, now = new Date()): Promise<BrokerWeekSummary> {
  brokerId = journeyUserIdSchema.parse(brokerId);
  const week = journeyWeek(now);
  const row = (await standings(tenantId, week.startsAt, week.endsAt)).find((r) => r.brokerId === brokerId);
  return { ...week, brokerId, points: row?.points ?? 0, previousPoints: row?.previousPoints ?? 0, pointsChange: (row?.points ?? 0) - (row?.previousPoints ?? 0), totalPoints: row?.totalPoints ?? 0 };
}
export async function unitLeaderboard(tenantId: string, branchId: string, brokerId = "", now = new Date()) {
  const week = journeyWeek(now);
  if (brokerId) brokerId = journeyUserIdSchema.parse(brokerId);
  const enabled = await getFeatureFlag(FEATURE_FLAGS.TEAM_RANKING).catch(() => "false");
  const rows = enabled === "true" ? await standings(tenantId, week.startsAt, week.endsAt) : [];
  return buildUnitLeaderboard(week, rows.filter((r) => r.branchId === branchId), brokerId);
}
export async function teamLeaderboard(tenantId: string, branchId?: string, now = new Date()) {
  const week = journeyWeek(now);
  if (await getFeatureFlag(FEATURE_FLAGS.TEAM_RANKING).catch(() => "false") !== "true") return buildTeamLeaderboard(week, [], []);
  const [rows, profiles] = await Promise.all([standings(tenantId, week.startsAt, week.endsAt), teamProfiles(tenantId)]);
  return buildTeamLeaderboard(week, rows.filter((r) => !branchId || r.branchId === branchId), profiles.filter((r) => !branchId || r.branchId === branchId));
}
export async function teamInternal(tenantId: string, supervisorId: string, now = new Date(), viewerId?: string) {
  supervisorId = journeyUserIdSchema.parse(supervisorId);
  const week = journeyWeek(now);
  const rows = await getFeatureFlag(FEATURE_FLAGS.TEAM_RANKING).catch(() => "false") === "true" ? await standings(tenantId, week.startsAt, week.endsAt) : [];
  return buildTeamInternal(week, rows, supervisorId, viewerId);
}

/** Journey ranking movement restricted to broker IDs already resolved by a server-side team/unit query. */
export async function journeyPositionChangesForBrokers(tenantId: string, brokerIds: readonly string[], now = new Date()) {
  const allowedIds = new Set(brokerIds);
  if (!allowedIds.size || await getFeatureFlag(FEATURE_FLAGS.TEAM_RANKING).catch(() => "false") !== "true") return [];
  const week = journeyWeek(now);
  const visible = (await standings(tenantId, week.startsAt, week.endsAt))
    .filter((row) => allowedIds.has(row.brokerId) && !row.optedOut);
  return rankBrokers(visible).map((row) => ({ brokerId: row.brokerId, positionChange: row.positionChange }));
}
