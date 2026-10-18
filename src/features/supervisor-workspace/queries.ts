import "server-only";

import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";

import { getLocalDutyParts } from "@/features/leads/assignment";
import { periodDay } from "@/features/engagement/scoring";

import { getTeamOfferStats, statsWindow } from "@/features/engagement/broker-stats";
import { rankBroker, type BrokerOfferStats, type RankPosition } from "@/features/engagement/ranking";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

const WAITING = ["new", "distributed"] as const;
const IN_SERVICE = ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;
const TIME_ZONE = "America/Sao_Paulo";

export type TeamBroker = {
  userId: string;
  name: string;
  availability: string;
  /** Leads in service now. */
  inService: number;
  /** Assigned and still waiting for the first contact. */
  waiting: number;
  /** Waiting longer than the company SLA. */
  late: number;
  receivedToday: number;
  stats: BrokerOfferStats | null;
  /** Position inside the team (only this team, never the company list). */
  ranks: RankPosition[];
};

export type TeamDuty = {
  assignmentId?: string;
  brokerId: string;
  brokerName: string;
  scheduleName: string;
  startsAt: string;
  endsAt: string;
  paused: boolean;
  presence: "confirmed" | "pending" | "absent" | "expired" | "not_required";
};

export type AttentionLead = { leadId: string; name: string; brokerId: string | null; brokerName: string; assignedAt: Date | null; late: boolean };

export type SupervisorWorkspaceData = {
  viewer: { userId: string; tenantId: string; name: string; branchName: string | null };
  /** The team the supervisor created in Minha equipe (name, description), even before it has brokers. */
  teamIdentity?: { name: string; description: string | null } | null;
  team: TeamBroker[];
  /** Active brokers of the supervisor's unit with no supervisor (P2: "add to my team"). */
  freeBrokers: { userId: string; name: string }[];
  /** P5: who of the team has a plantão today (weekly roster or published occurrence) and the presence. */
  duty: TeamDuty[];
  /** P8: the team goal running now (scope team, scopeId = the supervisor). */
  goal: { name: string; percentage: number; currentValue: string; targetValue: string } | null;
  today: { receivedToday: number; inService: number; waiting: number; late: number };
  attention: AttentionLead[];
  unreadNotifications: number;
  latestNotificationTitle: string | null;
  slaMinutes: number;
  updatedAt: Date;
};

function dayStart(now: Date) {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
  return new Date(`${key}T00:00:00-03:00`);
}

/**
 * The supervisor's team at a glance (S2 of the supervisor Lite): only active
 * brokers whose supervisor is the viewer; an empty team is an empty screen.
 */
export async function getSupervisorWorkspaceData(context: TenantContext, now = new Date()): Promise<SupervisorWorkspaceData> {
  if (context.role !== "supervisor") throw new Error("Só o supervisor tem a visão da equipe.");
  const db = getDatabase();
  const memberships = schema.tenantMemberships;

  const [viewerRows, teamRows, tenantRows, unreadRows, latestRows, freeRows, goalRows] = await Promise.all([
    db.select({ name: schema.user.name, branchName: schema.branches.name }).from(schema.user)
      .leftJoin(schema.branches, eq(schema.branches.id, sql`${context.branchId}`))
      .where(eq(schema.user.id, context.userId)).limit(1),
    db.select({ userId: memberships.userId, name: schema.user.name, availability: memberships.availabilityStatus })
      .from(memberships)
      .innerJoin(schema.user, eq(schema.user.id, memberships.userId))
      .where(and(
        eq(memberships.tenantId, context.tenantId),
        eq(memberships.supervisorId, context.userId),
        eq(memberships.status, "active"),
        eq(memberships.role, "broker"),
        // A supervisor of a unit only follows brokers of that unit (stale links never widen the team).
        context.branchId ? eq(memberships.branchId, context.branchId) : undefined,
      ))
      .orderBy(asc(schema.user.name)),
    db.select({ sla: schema.tenants.slaFirstContactMinutes }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1),
    db.select({ total: count() }).from(schema.notifications)
      .where(and(eq(schema.notifications.tenantId, context.tenantId), eq(schema.notifications.recipientUserId, context.userId), isNull(schema.notifications.readAt))),
    db.select({ title: schema.notifications.title }).from(schema.notifications)
      .where(and(eq(schema.notifications.tenantId, context.tenantId), eq(schema.notifications.recipientUserId, context.userId), isNull(schema.notifications.readAt)))
      .orderBy(desc(schema.notifications.createdAt)).limit(1),
    context.branchId
      ? db.select({ userId: memberships.userId, name: schema.user.name }).from(memberships)
        .innerJoin(schema.user, eq(schema.user.id, memberships.userId))
        .where(and(eq(memberships.tenantId, context.tenantId), eq(memberships.branchId, context.branchId), eq(memberships.role, "broker"), eq(memberships.status, "active"), isNull(memberships.supervisorId), eq(schema.user.active, true)))
        .orderBy(asc(schema.user.name)).limit(20)
      : Promise.resolve([] as { userId: string; name: string }[]),
    db.select({ name: schema.goals.name, targetValue: schema.goals.targetValue, currentValue: schema.goalProgress.currentValue, percentage: schema.goalProgress.percentage })
      .from(schema.goals)
      .leftJoin(schema.goalProgress, eq(schema.goalProgress.goalId, schema.goals.id))
      .where(and(eq(schema.goals.tenantId, context.tenantId), eq(schema.goals.scope, "team"), eq(schema.goals.scopeId, context.userId), eq(schema.goals.active, true), lt(schema.goals.startDate, now), gte(schema.goals.endDate, now)))
      .orderBy(desc(schema.goals.endDate))
      .limit(1),
  ]);

  const slaMinutes = Math.max(1, Number.parseInt(tenantRows[0]?.sla ?? "15", 10) || 15);
  const teamIds = teamRows.map((row) => row.userId);
  const lateBefore = new Date(now.getTime() - slaMinutes * 60_000);
  const today = dayStart(now);

  const [counts, attentionRows, teamStats] = teamIds.length
    ? await Promise.all([
      db.select({
        brokerId: schema.leads.corretorId,
        inService: sql<number>`count(*) filter (where ${inArray(schema.leads.status, [...IN_SERVICE])})`,
        waiting: sql<number>`count(*) filter (where ${inArray(schema.leads.status, [...WAITING])} and ${schema.leads.firstContactAt} is null)`,
        late: sql<number>`count(*) filter (where ${inArray(schema.leads.status, [...WAITING])} and ${schema.leads.firstContactAt} is null and ${schema.leads.assignedAt} < ${lateBefore.toISOString()}::timestamptz)`,
        receivedToday: sql<number>`count(*) filter (where ${schema.leads.assignedAt} >= ${today.toISOString()}::timestamptz)`,
      }).from(schema.leads)
        .where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.corretorId, teamIds), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt)))
        .groupBy(schema.leads.corretorId),
      db.select({ leadId: schema.leads.id, name: schema.leads.nome, brokerId: schema.leads.corretorId, assignedAt: schema.leads.assignedAt })
        .from(schema.leads)
        .where(and(
          eq(schema.leads.tenantId, context.tenantId),
          inArray(schema.leads.corretorId, teamIds),
          inArray(schema.leads.status, [...WAITING]),
          isNull(schema.leads.firstContactAt),
          isNull(schema.leads.deletedAt),
          isNull(schema.leads.archivedAt),
          lt(schema.leads.assignedAt, now),
          gte(schema.leads.assignedAt, new Date(now.getTime() - 7 * 86_400_000)),
        ))
        .orderBy(asc(schema.leads.assignedAt))
        .limit(12),
      getTeamOfferStats(context.tenantId, statsWindow(now)).then((rows) => rows.filter((row) => teamIds.includes(row.brokerId))),
    ])
    : [[], [], [] as BrokerOfferStats[]];

  // P5: plantões of the team today (read only; the roster stays with the manager).
  const local = getLocalDutyParts(now);
  const dutyRows = teamIds.length
    ? await db.select({
      assignmentId: schema.dutyRosterAssignments.id,
      brokerId: schema.dutyRosterAssignments.brokerId,
      scheduleName: schema.unitDutySchedules.name,
      startsAt: schema.dutyRosterAssignments.startsAt,
      endsAt: schema.dutyRosterAssignments.endsAt,
      pausedAt: schema.dutyRosterAssignments.pausedAt,
    }).from(schema.dutyRosterAssignments)
      .innerJoin(schema.unitDutySchedules, and(eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId), eq(schema.unitDutySchedules.tenantId, schema.dutyRosterAssignments.tenantId)))
      .where(and(
        eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
        inArray(schema.dutyRosterAssignments.brokerId, teamIds),
        eq(schema.dutyRosterAssignments.status, "active"),
        eq(schema.unitDutySchedules.status, "active"),
        or(
          eq(schema.dutyRosterAssignments.dutyDate, periodDay(now)),
          and(isNull(schema.dutyRosterAssignments.dutyDate), eq(schema.dutyRosterAssignments.dayOfWeek, local.weekday), lte(schema.dutyRosterAssignments.validFrom, now), or(isNull(schema.dutyRosterAssignments.validUntil), gt(schema.dutyRosterAssignments.validUntil, now))),
        ),
      ))
      .orderBy(asc(schema.dutyRosterAssignments.startsAt))
    : [];
  const presenceRows = dutyRows.length
    ? await db.select({ assignmentId: schema.dutyPresenceConfirmations.assignmentId, status: schema.dutyPresenceConfirmations.status })
      .from(schema.dutyPresenceConfirmations)
      .where(and(eq(schema.dutyPresenceConfirmations.tenantId, context.tenantId), inArray(schema.dutyPresenceConfirmations.brokerId, teamIds), eq(schema.dutyPresenceConfirmations.dutyDate, periodDay(now))))
      .orderBy(desc(schema.dutyPresenceConfirmations.createdAt))
    : [];
  const presenceBy = new Map<string, string>();
  for (const row of presenceRows) if (!presenceBy.has(row.assignmentId)) presenceBy.set(row.assignmentId, row.status);

  const countBy = new Map(counts.map((row) => [row.brokerId, row]));
  const nameBy = new Map(teamRows.map((row) => [row.userId, row.name]));
  const team: TeamBroker[] = teamRows.map((row) => {
    const c = countBy.get(row.userId);
    return {
      userId: row.userId,
      name: row.name,
      availability: row.availability,
      inService: Number(c?.inService ?? 0),
      waiting: Number(c?.waiting ?? 0),
      late: Number(c?.late ?? 0),
      receivedToday: Number(c?.receivedToday ?? 0),
      stats: teamStats.find((stats) => stats.brokerId === row.userId) ?? null,
      ranks: rankBroker(teamStats, row.userId),
    };
  });
  const sum = (key: "receivedToday" | "inService" | "waiting" | "late") => team.reduce((total, broker) => total + broker[key], 0);

  const [teamIdentity] = await db.select({ name: schema.supervisorTeams.name, description: schema.supervisorTeams.description })
    .from(schema.supervisorTeams)
    .where(and(eq(schema.supervisorTeams.tenantId, context.tenantId), eq(schema.supervisorTeams.supervisorId, context.userId)))
    .limit(1);

  return {
    viewer: { userId: context.userId, tenantId: context.tenantId, name: viewerRows[0]?.name ?? "Supervisor", branchName: viewerRows[0]?.branchName ?? null },
    teamIdentity: teamIdentity ?? null,
    team,
    freeBrokers: freeRows,
    duty: dutyRows.map((row) => {
      const presence = presenceBy.get(row.assignmentId);
      return {
        assignmentId: row.assignmentId,
        brokerId: row.brokerId,
        brokerName: nameBy.get(row.brokerId) ?? "Corretor",
        scheduleName: row.scheduleName,
        startsAt: row.startsAt.slice(0, 5),
        endsAt: row.endsAt.slice(0, 5),
        paused: Boolean(row.pausedAt),
        presence: presence === "confirmed" || presence === "pending" || presence === "absent" || presence === "expired" ? presence : "not_required",
      };
    }),
    goal: goalRows[0] ? {
      name: goalRows[0].name,
      percentage: Math.round(Number(goalRows[0].percentage ?? 0)),
      currentValue: String(Number(goalRows[0].currentValue ?? 0)),
      targetValue: String(Number(goalRows[0].targetValue)),
    } : null,
    today: { receivedToday: sum("receivedToday"), inService: sum("inService"), waiting: sum("waiting"), late: sum("late") },
    attention: attentionRows.map((row) => ({
      leadId: row.leadId,
      name: row.name,
      brokerId: row.brokerId,
      brokerName: nameBy.get(row.brokerId ?? "") ?? "Corretor",
      assignedAt: row.assignedAt,
      late: Boolean(row.assignedAt && row.assignedAt < lateBefore),
    })),
    unreadNotifications: Number(unreadRows[0]?.total ?? 0),
    latestNotificationTitle: latestRows[0]?.title ?? null,
    slaMinutes,
    updatedAt: now,
  };
}
