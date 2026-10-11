import "server-only";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { isSupervisorTeamScoped } from "@/features/team/supervisor-scope";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { journeyUserIdSchema } from "@/features/engagement/journey-validation";
import { journeyDay } from "@/features/engagement/journey-periods";
import type { JourneyNearCompletion } from "./director-types";

/** Near-completion notices are tenant- and team-scoped; no client broker IDs are accepted. */
export async function getSupervisorNearCompletionAlerts(context: TenantContext): Promise<JourneyNearCompletion[]> {
  if (!isSupervisorTeamScoped(context) || await getFeatureFlag(FEATURE_FLAGS.BROKER_JOURNEY).catch(() => "false") !== "true") return [];
  const db = getDatabase();
  const team = await db.select({ brokerId: schema.tenantMemberships.userId }).from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.supervisorId, context.userId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active"))).catch(() => []);
  if (!team.length) return [];
  const today = journeyDay(new Date());
  const near = await db.select({ brokerId: schema.engagementMissionProgress.subjectId, progress: schema.engagementMissionProgress.progress, target: schema.engagementMissionProgress.target }).from(schema.engagementMissionProgress)
    .innerJoin(schema.engagementMissions, and(eq(schema.engagementMissions.id, schema.engagementMissionProgress.missionId), eq(schema.engagementMissions.tenantId, context.tenantId)))
    .where(and(eq(schema.engagementMissionProgress.tenantId, context.tenantId), eq(schema.engagementMissionProgress.subjectType, "broker"),
      eq(schema.engagementMissionProgress.missionId, `journey:${context.tenantId}:fast-contact`), eq(schema.engagementMissionProgress.periodKey, today),
      isNull(schema.engagementMissionProgress.completedAt), eq(schema.engagementMissions.status, "active"))).catch(() => []);
  const nearIds = new Set(near.filter((row) => row.target - row.progress === 1).map((row) => row.brokerId));
  const nearTeam = team.filter((row) => nearIds.has(row.brokerId));
  if (!nearTeam.length) return [];
  const rows = await db.select({ key: schema.notifications.idempotencyKey, createdAt: schema.notifications.createdAt })
    .from(schema.notifications).where(and(eq(schema.notifications.tenantId, context.tenantId), eq(schema.notifications.recipientUserId, context.userId), eq(schema.notifications.type, "journey_near_completion"), inArray(schema.notifications.idempotencyKey, nearTeam.map((row) => `journey-near:${row.brokerId}:${today}`))))
    .orderBy(desc(schema.notifications.createdAt)).limit(30).catch(() => []);
  const ids = rows.flatMap((row) => {
    const brokerId = row.key?.split(":")[1];
    const parsed = brokerId ? journeyUserIdSchema.safeParse(brokerId) : null;
    return parsed?.success ? [parsed.data] : [];
  });
  if (!ids.length) return [];
  const users = await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, ids)).catch(() => []);
  const names = new Map(users.map((row) => [row.id, row.name]));
  return rows.flatMap((row) => {
    const brokerId = row.key?.split(":")[1];
    if (!brokerId || !names.has(brokerId)) return [];
    return [{ brokerId, brokerName: names.get(brokerId) ?? "Corretor", missionId: `journey:${context.tenantId}:fast-contact`, title: "Todo primeiro contato em até 5 min", remaining: 1, date: journeyDay(row.createdAt), href: `/equipe/${brokerId}` }];
  });
}
