import "server-only";

import { and, count, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { getAttentionSnapshot } from "@/features/reports/metrics/metrics-service";
import { resolveReportDataScope } from "@/features/reports/metrics/metric-scope";
import { zonedMidnight, localDateKey } from "@/features/lead-distribution/monthly-duty-plan";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { getDashboardWelcome } from "./welcome";

const TZ = "America/Sao_Paulo";
/** Distribution states of a lead that is waiting for a broker. */
const WAITING_STATES = ["queued", "unassigned", "returned_to_queue"] as const;

export type DashboardTodayQueue = { id: string | null; name: string; hue: number | null; today: number; waiting: number };
export type DashboardToday = {
  /** Leads that arrived today (São Paulo day). */
  received: number;
  /** Leads handed to a broker today. */
  distributed: number;
  /** Leads waiting for a broker right now (any day). */
  waiting: number;
  /** Leads with a broker that nobody started to serve yet (any day). */
  withoutFirstContact: number;
  queues: DashboardTodayQueue[];
};

/**
 * What matters today, in the viewer's report scope (a Gestor sees their own
 * unit): arrivals, distribution, waiting leads and leads per queue.
 */
export async function getDashboardToday(context: TenantContext, now = new Date(), resolvedScope?: Awaited<ReturnType<typeof resolveReportDataScope>>): Promise<DashboardToday> {
  const db = getDatabase();
  const scope = resolvedScope ?? await resolveReportDataScope(context);
  const todayStart = zonedMidnight(localDateKey(now, TZ), TZ);
  const alive = and(eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt), scope.leadScope);
  const waitingWhere = and(alive, isNull(schema.leads.corretorId), inArray(schema.leads.distributionStatus, [...WAITING_STATES]));
  const todayWhere = and(alive, gte(schema.leads.createdAt, todayStart));

  const [[received], [distributed], [waiting], [withoutFirstContact], todayByQueue, waitingByQueue] = await Promise.all([
    db.select({ value: count() }).from(schema.leads).where(todayWhere),
    db.select({ value: count() }).from(schema.leads).where(and(alive, isNotNull(schema.leads.corretorId), gte(schema.leads.assignedAt, todayStart))),
    db.select({ value: count() }).from(schema.leads).where(waitingWhere),
    db.select({ value: count() }).from(schema.leads).where(and(alive, isNotNull(schema.leads.corretorId), inArray(schema.leads.status, ["new", "distributed"]), isNull(schema.leads.serviceStartedAt))),
    db.select({ queueId: schema.leads.queueId, value: count() }).from(schema.leads).where(todayWhere).groupBy(schema.leads.queueId),
    db.select({ queueId: schema.leads.queueId, value: count() }).from(schema.leads).where(waitingWhere).groupBy(schema.leads.queueId),
  ]);

  const queueIds = [...new Set([...todayByQueue, ...waitingByQueue].map((row) => row.queueId).filter((id): id is string => Boolean(id)))];
  const queueRows = queueIds.length
    ? await db.select({ id: schema.leadQueues.id, name: schema.leadQueues.name, hue: schema.leadQueues.colorHue })
      .from(schema.leadQueues)
      .where(and(eq(schema.leadQueues.tenantId, context.tenantId), inArray(schema.leadQueues.id, queueIds)))
    : [];
  const queueById = new Map(queueRows.map((row) => [row.id, row]));
  const byQueue = new Map<string, DashboardTodayQueue>();
  const entry = (queueId: string | null) => {
    const key = queueId ?? "__none";
    const queue = queueId ? queueById.get(queueId) : undefined;
    const current = byQueue.get(key) ?? { id: queueId, name: queue?.name ?? "Sem fila", hue: queue?.hue ?? null, today: 0, waiting: 0 };
    byQueue.set(key, current);
    return current;
  };
  for (const row of todayByQueue) entry(row.queueId).today += Number(row.value);
  for (const row of waitingByQueue) entry(row.queueId).waiting += Number(row.value);

  return {
    received: Number(received?.value ?? 0),
    distributed: Number(distributed?.value ?? 0),
    waiting: Number(waiting?.value ?? 0),
    withoutFirstContact: Number(withoutFirstContact?.value ?? 0),
    queues: [...byQueue.values()].sort((a, b) => b.today - a.today || b.waiting - a.waiting || a.name.localeCompare(b.name, "pt-BR")),
  };
}

export type CommandCenterData = Awaited<ReturnType<typeof getCommandCenterData>>;

/**
 * Everything the dashboard (the command center) shows: today's numbers, the
 * plantões running now, what needs attention and the latest leads. Lighter
 * than the old reporting dashboard: no funnel, trend or rankings here.
 */
export async function getCommandCenterData(context: TenantContext) {
  const db = getDatabase();
  const scope = await resolveReportDataScope(context);
  const [today, welcome, attention, recentLeads] = await Promise.all([
    getDashboardToday(context, new Date(), scope),
    getDashboardWelcome(context),
    getAttentionSnapshot(context, 7),
    db.select({ id: schema.leads.id, name: schema.leads.nome, status: schema.leads.status, branchName: schema.branches.name, createdAt: schema.leads.createdAt })
      .from(schema.leads)
      .leftJoin(schema.branches, and(eq(schema.leads.branchId, schema.branches.id), eq(schema.branches.tenantId, context.tenantId)))
      .where(and(eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt), scope.leadScope))
      .orderBy(sql`${schema.leads.createdAt} desc`)
      .limit(6),
  ]);
  return {
    today,
    welcome,
    attention: attention.items.filter((item) => item.count > 0).map((item) => ({ ...item, tone: item.count > 5 ? "danger" as const : "warning" as const })),
    recentLeads: recentLeads.map((row) => ({ id: row.id, name: row.name, status: row.status, branchName: row.branchName, createdAt: row.createdAt.toISOString() })),
    generatedAt: new Date().toISOString(),
  };
}
