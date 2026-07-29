import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";

export type PerformanceSeasonRecord = {
  id: string; name: string; status: "draft" | "active" | "closed" | "archived";
  startsAt: Date; endsAt: Date | null; resetAt: Date | null; resetReason: string | null;
};
export type PerformanceAwardRecord = {
  id: string; seasonId: string; rankPosition: number; title: string; description: string | null;
  rewardType: "recognition" | "bonus" | "gift" | "other"; rewardValue: string | null; active: boolean;
};

/** Global kill switch. Historical seasons and awards remain intact when disabled. */
export async function isPerformanceRankingEnabled() {
  return (await getSystemSetting("feature_performance_ranking_enabled")) !== "false";
}

export async function getDirectorPerformanceWorkspace() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [seasons, awards] = await Promise.all([
    db.select({ id: schema.performanceSeasons.id, name: schema.performanceSeasons.name, status: schema.performanceSeasons.status, startsAt: schema.performanceSeasons.startsAt, endsAt: schema.performanceSeasons.endsAt, resetAt: schema.performanceSeasons.resetAt, resetReason: schema.performanceSeasons.resetReason })
      .from(schema.performanceSeasons).where(eq(schema.performanceSeasons.tenantId, context.tenantId)).orderBy(desc(schema.performanceSeasons.startsAt)),
    db.select({ id: schema.performanceAwards.id, seasonId: schema.performanceAwards.seasonId, rankPosition: schema.performanceAwards.rankPosition, title: schema.performanceAwards.title, description: schema.performanceAwards.description, rewardType: schema.performanceAwards.rewardType, rewardValue: schema.performanceAwards.rewardValue, active: schema.performanceAwards.active })
      .from(schema.performanceAwards).where(eq(schema.performanceAwards.tenantId, context.tenantId)).orderBy(schema.performanceAwards.rankPosition),
  ]);
  return { seasons: seasons as PerformanceSeasonRecord[], awards: awards as PerformanceAwardRecord[] };
}
