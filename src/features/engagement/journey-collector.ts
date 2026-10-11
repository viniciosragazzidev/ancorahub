import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { evaluateAchievements } from "./achievements";
import { evaluateLevel } from "./levels";
import { defaultJourneyMissions, evaluateMission, missionBonus, selectDailyMissions } from "./missions";
import { defaultTeamMissions, evaluateTeamMission } from "./team-missions";
import { journeyDay, journeyMidnight, journeyWeek, shiftJourneyDay } from "./journey-periods";
import { journeyMissionSchema } from "./journey-validation";
import { readJourneyFacts } from "./journey-facts";
import { resolveRules } from "./catalog";
import { periodDay, type PointsCandidate } from "./scoring";
import type { AchievementKey, JourneyCelebrationPayload } from "./journey-types";
import { dailyJourneySummary, isJourneySummaryDue } from "./daily-summary";
import { publishNotification } from "@/features/notifications/send-push-helper";

/** Includes denominator changes and deadlines even when no points rule scores. */
export async function touchedJourneyBrokers(tenantId: string, since: Date, until: Date, slaMinutes: number): Promise<string[]> {
  const from = since.toISOString(), to = until.toISOString();
  const today = journeyDay(until);
  const closedWeek = journeyWeek(until).startsAt === today ? shiftJourneyDay(today, -7) : "";
  const summaryDue = isJourneySummaryDue(until);
  const stagesCloseAt = new Date(journeyMidnight(today).getTime() + 30 * 60_000).toISOString();
  const rows = await getDatabase().execute<{ broker: string }>(sql`
    select distinct broker from (
      select corretor_id as broker from leads where tenant_id=${tenantId} and deleted_at is null
        and ((assigned_at>=${from}::timestamptz and assigned_at<${to}::timestamptz) or (service_started_at>=${from}::timestamptz and service_started_at<${to}::timestamptz)
          or (assigned_at+(${slaMinutes} * interval '1 minute')>=${from}::timestamptz and assigned_at+(${slaMinutes} * interval '1 minute')<${to}::timestamptz)
          or (assigned_at+interval '30 minutes'>=${from}::timestamptz and assigned_at+interval '30 minutes'<${to}::timestamptz)
          or (updated_at>=${from}::timestamptz and updated_at<${to}::timestamptz and assigned_at is not null))
      union all select broker_id from lead_offers where tenant_id=${tenantId} and offered_at>=${from}::timestamptz and offered_at<${to}::timestamptz
      union all select assigned_to from lead_tasks where tenant_id=${tenantId} and ((completed_at>=${from}::timestamptz and completed_at<${to}::timestamptz) or (due_at>=${from}::timestamptz and due_at<${to}::timestamptz))
      union all select broker_id from duty_presence_confirmations where tenant_id=${tenantId} and ((confirmed_at>=${from}::timestamptz and confirmed_at<${to}::timestamptz) or (shift_ends_at>=${from}::timestamptz and shift_ends_at<${to}::timestamptz))
      union all select i.user_id from lead_interactions i join leads l on l.id=i.lead_id and l.tenant_id=${tenantId} where i.tipo='note' and i.created_at>=${from}::timestamptz and i.created_at<${to}::timestamptz
      union all select subject_id from engagement_mission_progress where tenant_id=${tenantId} and subject_type='broker' and completed_at is null
        and period_key in (${shiftJourneyDay(today, -1)}, ${closedWeek}) and updated_at<${journeyMidnight(today).toISOString()}::timestamptz
      union all select m.user_id from engagement_mission_progress p join tenant_memberships m
        on m.tenant_id=p.tenant_id and m.supervisor_id=p.subject_id and m.role='broker' and m.status='active'
        where p.tenant_id=${tenantId} and p.subject_type='supervisor' and p.completed_at is null
          and p.period_key in (${shiftJourneyDay(today, -1)}, ${closedWeek}) and p.updated_at<${journeyMidnight(today).toISOString()}::timestamptz
      union all select p.subject_id from engagement_mission_progress p join engagement_missions m
        on m.id=p.mission_id and m.tenant_id=${tenantId} and m.metric='steps.coverage'
        where p.tenant_id=${tenantId} and p.completed_at is null and p.period_key=${shiftJourneyDay(today, -1)}
          and ${to}::timestamptz>=${stagesCloseAt}::timestamptz and p.updated_at<${stagesCloseAt}::timestamptz
      union all select broker_id from engagement_point_events e where tenant_id=${tenantId} and ${summaryDue}
        and period_day=${today}::date and reversed_at is null and not exists (
          select 1 from engagement_celebrations c where c.tenant_id=${tenantId} and c.idempotency_key='daily_summary:'||e.broker_id||':'||${today})
      union all select corretor_id from leads l where tenant_id=${tenantId} and ${summaryDue} and deleted_at is null
        and assigned_at>=${journeyMidnight(today).toISOString()}::timestamptz and assigned_at<${to}::timestamptz
        and not exists (select 1 from engagement_celebrations c where c.tenant_id=${tenantId} and c.idempotency_key='daily_summary:'||l.corretor_id||':'||${today})
    ) touched where broker is not null`).catch(() => []);
  return rows.map((row) => row.broker);
}

/** One batch, one progress upsert and idempotent inserts; never sweeps every broker. */
export async function collectJourneyBatch(input: { tenantId: string; brokerIds: string[]; candidates: PointsCandidate[]; now: Date; slaMinutes: number; rules: ReturnType<typeof resolveRules> }) {
  const { tenantId, now, slaMinutes, rules } = input;
  if (!input.brokerIds.length || await getFeatureFlag(FEATURE_FLAGS.BROKER_JOURNEY).catch(() => "false") !== "true") return { available: false, brokers: 0 };
  const db = getDatabase();
  const touchedBrokerIds = [...new Set(input.brokerIds)];
  const touchedMemberships = await db.select({ brokerId: schema.tenantMemberships.userId, supervisorId: schema.tenantMemberships.supervisorId, branchId: schema.tenantMemberships.branchId })
    .from(schema.tenantMemberships).where(and(eq(schema.tenantMemberships.tenantId, tenantId), inArray(schema.tenantMemberships.userId, touchedBrokerIds), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"))).catch(() => []);
  const touchedSupervisorIds = [...new Set(touchedMemberships.flatMap((row) => row.supervisorId ? [row.supervisorId] : []))];
  const [supervisorRows, activeTeamRows] = await Promise.all([
    touchedSupervisorIds.length ? db.select({ supervisorId: schema.tenantMemberships.userId, branchId: schema.tenantMemberships.branchId }).from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, tenantId), inArray(schema.tenantMemberships.userId, touchedSupervisorIds), eq(schema.tenantMemberships.role, "supervisor"), eq(schema.tenantMemberships.status, "active"))).catch(() => []) : Promise.resolve([]),
    touchedSupervisorIds.length ? db.select({ brokerId: schema.tenantMemberships.userId, supervisorId: schema.tenantMemberships.supervisorId, branchId: schema.tenantMemberships.branchId }).from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(eq(schema.tenantMemberships.tenantId, tenantId), inArray(schema.tenantMemberships.supervisorId, touchedSupervisorIds), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active"))).catch(() => []) : Promise.resolve([]),
  ]);
  const supervisorBranch = new Map(supervisorRows.map((row) => [row.supervisorId, row.branchId]));
  const teamMemberships = activeTeamRows.filter((row) => Boolean(row.supervisorId) && row.branchId === supervisorBranch.get(row.supervisorId!));
  const brokerIds = [...new Set([...touchedBrokerIds, ...teamMemberships.map((row) => row.brokerId)])];
  const teamBrokerIds = new Set(teamMemberships.map((row) => row.brokerId));
  // Catch outside transactions: a missing table must not poison an open transaction.
  const [missionsRead, previousRead, earnedRead, celebrationsReady, campaigns] = await Promise.all([
    db.select().from(schema.engagementMissions).where(eq(schema.engagementMissions.tenantId, tenantId)).catch(() => null),
    db.select().from(schema.engagementMissionProgress).where(and(eq(schema.engagementMissionProgress.tenantId, tenantId), inArray(schema.engagementMissionProgress.subjectId, [...brokerIds, ...touchedSupervisorIds]))).catch(() => null),
    db.select().from(schema.engagementAchievements).where(and(eq(schema.engagementAchievements.tenantId, tenantId), inArray(schema.engagementAchievements.brokerId, brokerIds))).catch(() => null),
    db.select({ id: schema.engagementCelebrations.id }).from(schema.engagementCelebrations).where(eq(schema.engagementCelebrations.tenantId, tenantId)).limit(1).catch(() => null),
    getFeatureFlag(FEATURE_FLAGS.ENGAGEMENT_CAMPAIGNS).catch(() => "false"),
  ]);
  if (!missionsRead || !previousRead || !earnedRead || !celebrationsReady) return { available: false, brokers: 0 };
  const defaults = [...defaultJourneyMissions(tenantId), ...defaultTeamMissions(tenantId)];
  await db.insert(schema.engagementMissions).values(defaults.map((m) => ({ ...m, tenantId, createdAt: now, updatedAt: now, startsAt: null, endsAt: null }))).onConflictDoNothing();
  const storedIds = new Set(missionsRead.map((m) => m.id));
  const missions = [...missionsRead, ...defaults.filter((m) => !storedIds.has(m.id))].flatMap((row) => {
    const parsed = journeyMissionSchema.safeParse({ ...row, startsAt: row.startsAt instanceof Date ? row.startsAt.toISOString() : row.startsAt, endsAt: row.endsAt instanceof Date ? row.endsAt.toISOString() : row.endsAt });
    return parsed.success && (parsed.data.kind !== "campaign" || campaigns === "true") ? [parsed.data] : [];
  });
  const facts = await readJourneyFacts(tenantId, brokerIds, now, slaMinutes, rules["sale.approved"].enabled);
  if (!facts.length) return { available: true, brokers: 0 };
  const today = journeyDay(now), yesterday = shiftJourneyDay(today, -1);
  const progressValues: (typeof schema.engagementMissionProgress.$inferInsert)[] = [];
  const bonuses: (typeof schema.engagementPointEvents.$inferInsert)[] = [];
  const achievementValues: (typeof schema.engagementAchievements.$inferInsert)[] = [];
  const celebrations: (typeof schema.engagementCelebrations.$inferInsert)[] = [];
  const celebrate = (userId: string, key: string, payload: JourneyCelebrationPayload, priority: number) => celebrations.push({ id: randomUUID(), tenantId, userId, idempotencyKey: key, kind: payload.kind, payload: { ...payload }, priority, createdAt: now });
  for (const candidate of input.candidates) if (facts.some((f) => f.subject.brokerId === candidate.brokerId)) {
    celebrate(candidate.brokerId, `points:${candidate.idempotencyKey}`, { kind: "points", points: candidate.points, ruleKey: candidate.ruleKey, label: rules[candidate.ruleKey].label }, 10);
  }
  for (const fact of facts) {
    const brokerId = fact.subject.brokerId;
    for (const date of [yesterday, today]) {
      const hasDuty = fact.days.find((d) => d.date === date)?.hasDuty ?? false;
      for (const mission of selectDailyMissions(missions.filter((item) => item.kind !== "team"), hasDuty)) {
        if (date !== today && mission.period === "campaign") continue;
        if (date !== today && mission.period !== "daily" && journeyWeek(new Date(`${date}T12:00:00Z`)).periodKey === journeyWeek(now).periodKey) continue;
        const initial = evaluateMission({ mission, subject: fact.subject, days: fact.days, now, date });
        const previous = previousRead.find((p) => p.subjectId === brokerId && p.missionId === mission.id && p.periodKey === initial.periodKey);
        const progress = evaluateMission({ mission, subject: fact.subject, days: fact.days, now, date, previousCompletedAt: previous?.completedAt?.toISOString() });
        if (!progress.eligible && !progress.completed) continue;
        progressValues.push({ id: randomUUID(), tenantId, missionId: mission.id, subjectId: brokerId, periodKey: progress.periodKey, progress: progress.progress, target: progress.target, completedAt: progress.completedAt ? new Date(progress.completedAt) : null, createdAt: now, updatedAt: now });
        const bonus = missionBonus(mission, progress);
        if (bonus) {
          bonuses.push({ id: randomUUID(), tenantId, brokerId, ruleKey: "mission.completed", points: bonus.points, entityType: "mission", entityId: mission.id, idempotencyKey: bonus.idempotencyKey, occurredAt: new Date(bonus.occurredAt), periodDay: periodDay(new Date(bonus.occurredAt)), metadata: { missionId: mission.id, title: mission.title, periodKey: progress.periodKey, progress: progress.progress, target: progress.target } });
          celebrate(brokerId, bonus.idempotencyKey, { kind: "mission", missionId: mission.id, title: mission.title, bonusPoints: mission.bonusPoints, periodKey: progress.periodKey }, 40);
        }
      }
    }
    const earned = Object.fromEntries(earnedRead.filter((a) => a.brokerId === brokerId).map((a) => [a.badgeKey, a.earnedAt.toISOString()])) as Partial<Record<AchievementKey, string>>;
    for (const badge of evaluateAchievements({ evidence: fact.evidence, salesEnabled: rules["sale.approved"].enabled, earned })) if (badge.earned && !earned[badge.key]) {
      achievementValues.push({ id: randomUUID(), tenantId, brokerId, badgeKey: badge.key, earnedAt: now, evidence: { ...fact.evidence } });
      celebrate(brokerId, `achievement:${brokerId}:${badge.key}`, { kind: "achievement", badgeKey: badge.key, name: badge.name }, 50);
    }
  }
  for (const supervisorId of touchedSupervisorIds) {
    const memberFacts = facts.filter((fact) => teamMemberships.some((row) => row.supervisorId === supervisorId && row.brokerId === fact.subject.brokerId));
    if (!memberFacts.length) continue;
    for (const mission of missions.filter((item) => item.kind === "team")) {
      if (mission.audience.supervisorIds?.length && !mission.audience.supervisorIds.includes(supervisorId)) continue;
      const dates = mission.period === "daily" ? [yesterday, today] : [today];
      for (const date of dates) {
        const period = mission.period === "weekly" ? journeyWeek(new Date(`${date}T12:00:00Z`)).periodKey : date;
        const previous = previousRead.find((row) => row.subjectType === "supervisor" && row.subjectId === supervisorId && row.missionId === mission.id && row.periodKey === period);
        const evaluation = evaluateTeamMission({ mission, members: memberFacts.map((fact) => ({ brokerId: fact.subject.brokerId, days: fact.days })), now, date, previousCompleted: Boolean(previous?.completedAt) });
        if (!evaluation || (!evaluation.eligible && !evaluation.completed)) continue;
        const completedAt = previous?.completedAt ?? (evaluation.completed ? now : null);
        progressValues.push({ id: randomUUID(), tenantId, missionId: mission.id, subjectId: supervisorId, subjectType: "supervisor", periodKey: evaluation.periodKey, progress: evaluation.progress, target: evaluation.target, completedAt, createdAt: now, updatedAt: now });
        if (evaluation.completed && completedAt && mission.bonusPoints > 0) {
          for (const fact of memberFacts) {
            const brokerId = fact.subject.brokerId;
            const idempotencyKey = `mission:${mission.id}:team:${supervisorId}:${evaluation.periodKey}:${brokerId}`;
            bonuses.push({ id: randomUUID(), tenantId, brokerId, ruleKey: "mission.completed", points: mission.bonusPoints, entityType: "mission", entityId: mission.id, idempotencyKey, occurredAt: completedAt, periodDay: periodDay(completedAt), metadata: { missionId: mission.id, title: mission.title, periodKey: evaluation.periodKey, teamSupervisorId: supervisorId, progress: evaluation.progress, target: evaluation.target } });
            celebrate(brokerId, idempotencyKey, { kind: "mission", missionId: mission.id, title: mission.title, bonusPoints: mission.bonusPoints, periodKey: evaluation.periodKey }, 40);
          }
        }
      }
    }
  }
  const result = await db.transaction(async (tx) => {
    // All journey writers in this tenant share the lock; conflicts remain safe on retry.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`journey:${tenantId}`}))`);
    const uniqueProgress = [...new Map(progressValues.map((p) => [JSON.stringify([p.missionId, p.subjectId, p.periodKey]), p])).values()];
    if (uniqueProgress.length) await tx.insert(schema.engagementMissionProgress).values(uniqueProgress).onConflictDoUpdate({ target: [schema.engagementMissionProgress.tenantId, schema.engagementMissionProgress.missionId, schema.engagementMissionProgress.subjectId, schema.engagementMissionProgress.periodKey], set: {
      progress: sql`excluded.progress`, target: sql`excluded.target`, updatedAt: now,
      completedAt: sql`coalesce(${schema.engagementMissionProgress.completedAt}, excluded.completed_at)`,
    } });
    const insertedBonuses = bonuses.length ? await tx.insert(schema.engagementPointEvents).values(bonuses).onConflictDoNothing().returning({ brokerId: schema.engagementPointEvents.brokerId, points: schema.engagementPointEvents.points, periodDay: schema.engagementPointEvents.periodDay }) : [];
    if (achievementValues.length) await tx.insert(schema.engagementAchievements).values(achievementValues).onConflictDoNothing();
    for (const fact of facts) {
      const bonusPoints = insertedBonuses.filter((b) => b.brokerId === fact.subject.brokerId).reduce((n, b) => n + b.points, 0);
      const level = evaluateLevel(fact.totalPoints + bonusPoints);
      if (level.level.index > 0) celebrate(fact.subject.brokerId, `level:${fact.subject.brokerId}:${level.level.index}`, { kind: "level", level: level.level, totalPoints: level.totalPoints }, 60);
      const todayBonus = insertedBonuses.filter((b) => b.brokerId === fact.subject.brokerId && b.periodDay === today).reduce((n, b) => n + b.points, 0);
      const summary = dailyJourneySummary({ brokerId: fact.subject.brokerId, days: fact.days, points: (fact.pointsByDay?.[today] ?? 0) + todayBonus, now });
      if (summary) celebrate(fact.subject.brokerId, summary.key, summary.payload, 10);
    }
    // Remove duplicate weekly/campaign entries before a single batch insertion.
    const unique = [...new Map(celebrations.map((c) => [c.idempotencyKey, c])).values()];
    if (unique.length) await tx.insert(schema.engagementCelebrations).values(unique).onConflictDoNothing();
    return { available: true, brokers: touchedBrokerIds.filter((id) => facts.some((fact) => fact.subject.brokerId === id)).length, bonuses: insertedBonuses.length, teamBrokers: [...teamBrokerIds].length };
  });
  const todayProgress = progressValues.filter((row) => row.subjectType === "broker" && row.missionId === `journey:${tenantId}:fast-contact` && row.periodKey === today && row.completedAt === null && typeof row.target === "number" && typeof row.progress === "number" && row.target - row.progress === 1);
  const nearBrokerIds = [...new Set(todayProgress.map((row) => row.subjectId))];
  const nearNames = nearBrokerIds.length ? await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, nearBrokerIds)).catch(() => []) : [];
  const nameByBroker = new Map(nearNames.map((row) => [row.id, row.name?.trim() || "Um corretor da equipe"]));
  for (const row of todayProgress) {
    const membership = touchedMemberships.find((item) => item.brokerId === row.subjectId);
    const supervisorId = membership?.supervisorId;
    if (!supervisorId) continue;
    const brokerName = nameByBroker.get(row.subjectId) ?? "Um corretor da equipe";
    await publishNotification({
      capability: "journey_near_completion", tenantId, recipientUserId: supervisorId, type: "journey_near_completion",
      title: `${brokerName} está a 1 contato de completar a missão do dia`,
      message: "Acompanhe o primeiro contato para ajudar a equipe a fechar a missão.",
      url: `/equipe/${row.subjectId}`, tag: `journey-near:${row.subjectId}:${today}`,
      idempotencyKey: `journey-near:${row.subjectId}:${today}`,
    }).catch(() => undefined);
  }
  return result;
}
