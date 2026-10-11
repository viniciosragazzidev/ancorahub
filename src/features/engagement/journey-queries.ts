import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { resolveRules } from "./catalog";
import { brokerWeek, unitLeaderboard } from "./leaderboard-queries";
import { evaluateAchievements } from "./achievements";
import { evaluateLevel, evaluateStreak } from "./levels";
import { evaluateMission, selectDailyMissions } from "./missions";
import { evaluateTeamMission } from "./team-missions";
import { journeyDay, journeyWeek } from "./journey-periods";
import { journeyMissionSchema, journeyUserIdSchema } from "./journey-validation";
import { readJourneyFacts } from "./journey-facts";
import type { AchievementKey, BrokerJourneyData, JourneyCelebration, JourneyCelebrationPayload, JourneyPointRuleKey } from "./journey-types";

/** This polling path intentionally reads only the small unseen-celebrations queue. */
export async function getPendingJourneyCelebrations(tenantId: string, brokerId: string): Promise<JourneyCelebration[]> {
  brokerId = journeyUserIdSchema.parse(brokerId);
  if (await getFeatureFlag(FEATURE_FLAGS.BROKER_JOURNEY).catch(() => "false") !== "true") return [];
  const rows = await getDatabase().select().from(schema.engagementCelebrations)
    .where(and(eq(schema.engagementCelebrations.tenantId, tenantId), eq(schema.engagementCelebrations.userId, brokerId), isNull(schema.engagementCelebrations.seenAt)))
    .orderBy(desc(schema.engagementCelebrations.priority), schema.engagementCelebrations.createdAt, schema.engagementCelebrations.id).limit(30).catch(() => []);
  return rows.flatMap((row) => {
    const payload = row.payload as JourneyCelebrationPayload;
    if (payload.kind !== row.kind) return [];
    return [{ id: row.id, userId: row.userId, kind: payload.kind, payload, priority: row.priority, createdAt: row.createdAt.toISOString(), seenAt: row.seenAt?.toISOString() ?? null }];
  });
}

/** Internal server query. Callers supply the tenant and broker from authenticated context. */
export async function getJourneyDailySummaries(tenantId: string, brokerId: string): Promise<JourneyCelebration[]> {
  brokerId = journeyUserIdSchema.parse(brokerId);
  if (await getFeatureFlag(FEATURE_FLAGS.BROKER_JOURNEY).catch(() => "false") !== "true") return [];
  // Seen summaries stay in the conversation; the polling endpoint still reads only unseen items.
  const rows = await getDatabase().select().from(schema.engagementCelebrations)
    .where(and(eq(schema.engagementCelebrations.tenantId, tenantId), eq(schema.engagementCelebrations.userId, brokerId), eq(schema.engagementCelebrations.kind, "daily_summary")))
    .orderBy(desc(schema.engagementCelebrations.createdAt), schema.engagementCelebrations.id).limit(7).catch(() => []);
  return rows.flatMap((row) => {
    const payload = row.payload as JourneyCelebrationPayload;
    return payload.kind === "daily_summary" ? [{ id: row.id, userId: row.userId, kind: payload.kind, payload, priority: row.priority, createdAt: row.createdAt.toISOString(), seenAt: row.seenAt?.toISOString() ?? null }] : [];
  });
}

/** Internal server query. Callers supply the tenant and broker from authenticated context. */
export async function getBrokerJourneyData(tenantId: string, brokerId: string, now = new Date()): Promise<BrokerJourneyData> {
  brokerId = journeyUserIdSchema.parse(brokerId);
  const week = journeyWeek(now);
  const empty: BrokerJourneyData = { available: false, optedOut: false, ledger: [], week: { ...week, brokerId, points: 0, previousPoints: 0, pointsChange: 0, totalPoints: 0 }, level: evaluateLevel(0), streak: { current: 0, best: 0, lastDutyDate: null }, missions: [], achievements: [], leaderboard: null, celebrations: [] };
  if (await getFeatureFlag(FEATURE_FLAGS.BROKER_JOURNEY).catch(() => "false") !== "true") return empty;
  const db = getDatabase();
  const [members, missions, earned, settings, tenant, campaigns, ledger] = await Promise.all([
    db.select({ branchId: schema.tenantMemberships.branchId, supervisorId: schema.tenantMemberships.supervisorId, optedOut: schema.tenantMemberships.rankingOptOut }).from(schema.tenantMemberships).where(and(eq(schema.tenantMemberships.tenantId, tenantId), eq(schema.tenantMemberships.userId, brokerId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"))).limit(1).catch(() => null),
    db.select().from(schema.engagementMissions).where(and(eq(schema.engagementMissions.tenantId, tenantId), eq(schema.engagementMissions.status, "active"))).catch(() => null),
    db.select().from(schema.engagementAchievements).where(and(eq(schema.engagementAchievements.tenantId, tenantId), eq(schema.engagementAchievements.brokerId, brokerId))).catch(() => null),
    db.select().from(schema.engagementSettings).where(eq(schema.engagementSettings.tenantId, tenantId)).limit(1).catch(() => []),
    db.select({ sla: schema.tenants.slaFirstContactMinutes }).from(schema.tenants).where(eq(schema.tenants.id, tenantId)).limit(1),
    getFeatureFlag(FEATURE_FLAGS.ENGAGEMENT_CAMPAIGNS).catch(() => "false"),
    // Display reversals in the extrato; every scoring/ranking read excludes them.
    db.select().from(schema.engagementPointEvents).where(and(eq(schema.engagementPointEvents.tenantId, tenantId), eq(schema.engagementPointEvents.brokerId, brokerId))).orderBy(desc(schema.engagementPointEvents.occurredAt), desc(schema.engagementPointEvents.id)).limit(30).catch(() => []),
  ]);
  if (!members?.[0] || !missions || !earned) return empty;
  const member = members[0], rules = resolveRules(settings[0]?.rules);
  const progressSubjects = [brokerId, ...(member.supervisorId ? [member.supervisorId] : [])];
  const progress = await db.select().from(schema.engagementMissionProgress).where(and(eq(schema.engagementMissionProgress.tenantId, tenantId), inArray(schema.engagementMissionProgress.subjectId, progressSubjects))).catch(() => null);
  if (!progress) return empty;
  const facts = await readJourneyFacts(tenantId, [brokerId], now, Math.max(1, Number(tenant[0]?.sla ?? 15) || 15), rules["sale.approved"].enabled).catch(() => []);
  const fact = facts[0];
  if (!fact) return empty;
  const parsed = missions.flatMap((m) => {
    const result = journeyMissionSchema.safeParse({ ...m, startsAt: m.startsAt?.toISOString() ?? null, endsAt: m.endsAt?.toISOString() ?? null });
    return result.success && (result.data.kind !== "campaign" || campaigns === "true") ? [result.data] : [];
  });
  const today = journeyDay(now);
  const missionCards: BrokerJourneyData["missions"] = selectDailyMissions(parsed.filter((mission) => mission.kind !== "team"), fact.days.find((d) => d.date === today)?.hasDuty ?? false).flatMap((mission) => {
    const initial = evaluateMission({ mission, subject: fact.subject, days: fact.days, now });
    const previous = progress.find((p) => p.missionId === mission.id && p.periodKey === initial.periodKey);
    const current = evaluateMission({ mission, subject: fact.subject, days: fact.days, now, previousCompletedAt: previous?.completedAt?.toISOString() });
    return current.eligible ? [{ ...mission, progress: current }] : [];
  });
  if (member.supervisorId) {
    for (const mission of parsed.filter((item) => item.kind === "team" && (!item.audience.supervisorIds?.length || item.audience.supervisorIds.includes(member.supervisorId!)))) {
      const periodKey = mission.period === "weekly" ? journeyWeek(now).periodKey : today;
      const stored = progress.find((row) => row.subjectType === "supervisor" && row.subjectId === member.supervisorId && row.missionId === mission.id && row.periodKey === periodKey);
      if (!stored) continue;
      const contributionEvaluation = evaluateTeamMission({ mission, members: [{ brokerId, days: fact.days }], now, date: periodKey, previousCompleted: Boolean(stored.completedAt) });
      const target = Number(stored.target) || mission.target;
      const progressValue = Number(stored.progress) || 0;
      missionCards.push({ ...mission, contribution: contributionEvaluation?.contributions.get(brokerId) ?? 0, progress: {
        missionId: mission.id, subjectId: member.supervisorId, periodKey, progress: progressValue, target,
        percentage: Math.min(100, Math.floor(progressValue * 100 / Math.max(1, target))), remaining: Math.max(0, target - progressValue),
        eligible: true, completed: Boolean(stored.completedAt), completedAt: stored.completedAt?.toISOString() ?? null,
      } });
    }
  }
  const rankingEnabled = await getFeatureFlag(FEATURE_FLAGS.TEAM_RANKING).catch(() => "false") === "true";
  const [summary, leaderboard, celebrations] = await Promise.all([brokerWeek(tenantId, brokerId, now), rankingEnabled && member.branchId ? unitLeaderboard(tenantId, member.branchId, brokerId, now) : null, getPendingJourneyCelebrations(tenantId, brokerId)]);
  const ruleKeys = new Set<string>([...Object.keys(rules), "mission.completed", "recognition.bonus"]);
  return { available: true, optedOut: member.optedOut, week: summary, level: evaluateLevel(fact.totalPoints), streak: evaluateStreak(fact.days, today), missions: missionCards,
    achievements: evaluateAchievements({ evidence: fact.evidence, salesEnabled: rules["sale.approved"].enabled, earned: Object.fromEntries(earned.map((a) => [a.badgeKey, a.earnedAt.toISOString()])) as Partial<Record<AchievementKey, string>> }),
    leaderboard, celebrations, ledger: ledger.filter((event) => ruleKeys.has(event.ruleKey)).map((event) => ({
      id: event.id, ruleKey: event.ruleKey as JourneyPointRuleKey,
      label: event.ruleKey === "mission.completed" ? "Missão concluída" : event.ruleKey === "recognition.bonus" ? "Reconhecimento" : rules[event.ruleKey as keyof typeof rules].label,
      detail: typeof event.metadata.reason === "string" ? event.metadata.reason : typeof event.metadata.title === "string" ? event.metadata.title : typeof event.metadata.latencySeconds === "number" ? `Em ${Math.max(1, Math.ceil(event.metadata.latencySeconds / 60))} min` : null,
      points: event.points, occurredAt: event.occurredAt.toISOString(), reversed: Boolean(event.reversedAt),
    })),
  };
}
