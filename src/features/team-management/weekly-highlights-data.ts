import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { journeyPositionChangesForBrokers } from "@/features/engagement/leaderboard-queries";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { isBrokerVisibleInTeamMetricsScope, resolveTeamMetricsScope } from "./scope";
import { buildWeeklyHighlights, weeklySummaryValues, type WeeklySummaryValues } from "./g6-pure";
import type { TeamMetricBroker, TeamMetricWindow } from "./metrics";

export type WeeklyHighlightBrokerOption = { id: string; name: string };

export async function getWeeklyTeamSummary(input: {
  context: TenantContext;
  window: TeamMetricWindow;
  brokers: readonly TeamMetricBroker[];
  now: Date;
}): Promise<{ summary: WeeklySummaryValues; manualRecognitionBrokers: WeeklyHighlightBrokerOption[] }> {
  const scope = resolveTeamMetricsScope(input.context);
  const scoped = input.brokers.filter((broker) => isBrokerVisibleInTeamMetricsScope(scope, {
    tenantId: input.context.tenantId,
    branchId: broker.branchId,
    supervisorId: broker.supervisorId,
  }));
  const ids = scoped.map((broker) => broker.id);
  const membershipRows = ids.length
    ? await getDatabase().select({ userId: schema.tenantMemberships.userId, rankingOptOut: schema.tenantMemberships.rankingOptOut })
      .from(schema.tenantMemberships)
      .where(and(
        eq(schema.tenantMemberships.tenantId, scope.tenantId),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
        inArray(schema.tenantMemberships.userId, ids),
      ))
    : [];
  const optOut = new Set(membershipRows.filter((row) => row.rankingOptOut).map((row) => row.userId));
  const eligible = scoped.filter((broker) => !optOut.has(broker.id));
  const movements = await journeyPositionChangesForBrokers(scope.tenantId, eligible.map((broker) => broker.id), input.now);
  return {
    summary: weeklySummaryValues(input.window, buildWeeklyHighlights(eligible, movements)),
    manualRecognitionBrokers: scoped.map(({ id, name }) => ({ id, name })),
  };
}
