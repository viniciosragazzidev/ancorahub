import "server-only";

import { and, asc, count, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";

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

export type AttentionLead = { leadId: string; name: string; brokerName: string; assignedAt: Date | null; late: boolean };

export type SupervisorWorkspaceData = {
  viewer: { userId: string; tenantId: string; name: string; branchName: string | null };
  team: TeamBroker[];
  /** Active brokers of the supervisor's unit with no supervisor (P2: "add to my team"). */
  freeBrokers: { userId: string; name: string }[];
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

  const [viewerRows, teamRows, tenantRows, unreadRows, latestRows, freeRows] = await Promise.all([
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
        late: sql<number>`count(*) filter (where ${inArray(schema.leads.status, [...WAITING])} and ${schema.leads.firstContactAt} is null and ${schema.leads.assignedAt} < ${lateBefore})`,
        receivedToday: sql<number>`count(*) filter (where ${schema.leads.assignedAt} >= ${today})`,
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

  return {
    viewer: { userId: context.userId, tenantId: context.tenantId, name: viewerRows[0]?.name ?? "Supervisor", branchName: viewerRows[0]?.branchName ?? null },
    team,
    freeBrokers: freeRows,
    today: { receivedToday: sum("receivedToday"), inService: sum("inService"), waiting: sum("waiting"), late: sum("late") },
    attention: attentionRows.map((row) => ({
      leadId: row.leadId,
      name: row.name,
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
