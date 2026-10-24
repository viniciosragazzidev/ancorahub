import "server-only";

import { and, count, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";

import { getAttentionSnapshot } from "@/features/reports/metrics/metrics-service";
import { resolveReportDataScope } from "@/features/reports/metrics/metric-scope";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { notStatusBroadcastSql } from "@/features/conversations/status-broadcast";
import { getDashboardWelcome } from "./welcome";
import { summarizeWhatsAppActivity } from "./whatsapp-activity";
import { brokerWhatsAppMembershipScope, brokerWhatsAppMessageSourceCondition } from "./whatsapp-activity-query";
import { overviewWindowBounds, resolveOverviewBranch, type OverviewFilter, type OverviewWindow } from "./overview-filter";

/** Distribution states of a lead that is waiting for a broker. */
const WAITING_STATES = ["queued", "unassigned", "returned_to_queue"] as const;

export type DashboardTodayQueue = { id: string | null; name: string; hue: number | null; today: number; waiting: number };
export type DashboardToday = {
  /** Leads that arrived in today's operation day (since 19:00, like the quality report). */
  received: number;
  /** Leads handed to a broker in today's operation day. */
  distributed: number;
  /** Leads waiting for a broker right now (any day). */
  waiting: number;
  /** Leads with a broker that nobody started to serve yet (any day). */
  withoutFirstContact: number;
  queues: DashboardTodayQueue[];
  /** Period and unit the arrivals/distribution were counted in ("today" when no filter is given). */
  window: OverviewWindow;
};

type ReportScope = Awaited<ReturnType<typeof resolveReportDataScope>>;

/** A Diretor asked for a unit that is not one of the tenant's. */
export class OverviewBranchNotFoundError extends Error {
  constructor() {
    super("Unidade não encontrada nesta empresa.");
    this.name = "OverviewBranchNotFoundError";
  }
}

/** The overview filter after the role rules and the tenant check (see `resolveOverviewFilter`). */
export type ResolvedOverviewFilter = {
  readonly resolved: true;
  readonly window: OverviewWindow;
  readonly since: Date;
  /** Unit to add to the queries; null when the report scope already sets it (Gestor) or there is none. */
  readonly narrowBranchId: string | null;
};

/**
 * Applies the overview filter to the viewer: tenant always from the session,
 * a unit only for a Diretor (checked against the tenant, one primary-key
 * lookup and only when a unit was asked), the Gestor's own unit and the
 * Supervisor's team stay as the report scope sets them.
 */
export async function resolveOverviewFilter(context: TenantContext, scope: ReportScope, filter: OverviewFilter = {}, now = new Date()): Promise<ResolvedOverviewFilter> {
  const period = filter.period ?? "today";
  const { start, end } = overviewWindowBounds(period, now);
  const branch = resolveOverviewBranch({
    role: context.role,
    sessionBranchId: context.branchId,
    canCompareUnits: scope.canCompareUnits,
    requestedBranchId: filter.branchId,
  });
  if (branch.source === "request" && branch.branchId) {
    const [row] = await getDatabase()
      .select({ id: schema.branches.id })
      .from(schema.branches)
      .where(and(eq(schema.branches.id, branch.branchId), eq(schema.branches.tenantId, context.tenantId)))
      .limit(1);
    if (!row) throw new OverviewBranchNotFoundError();
  }
  return {
    resolved: true,
    window: { period, start: start.toISOString(), end: end.toISOString(), branchId: branch.branchId },
    since: start,
    narrowBranchId: branch.source === "request" ? branch.branchId : null,
  };
}

function isResolvedFilter(filter: OverviewFilter | ResolvedOverviewFilter | undefined): filter is ResolvedOverviewFilter {
  return Boolean(filter && "resolved" in filter && filter.resolved);
}

function overviewFilterFor(context: TenantContext, scope: ReportScope, filter: OverviewFilter | ResolvedOverviewFilter | undefined, now: Date) {
  return isResolvedFilter(filter) ? Promise.resolve(filter) : resolveOverviewFilter(context, scope, filter, now);
}

/**
 * What matters today, in the viewer's report scope (a Gestor sees their own
 * unit): arrivals, distribution, waiting leads and leads per queue.
 * `filter` widens arrivals/distribution to 7 or 30 operation days and lets a
 * Diretor pick one unit; waiting and without first contact stay "right now".
 */
export async function getDashboardToday(context: TenantContext, now = new Date(), resolvedScope?: ReportScope, filter?: OverviewFilter | ResolvedOverviewFilter): Promise<DashboardToday> {
  const db = getDatabase();
  const scope = resolvedScope ?? await resolveReportDataScope(context);
  const overview = await overviewFilterFor(context, scope, filter, now);
  // The operation day turns at 19:00, the same window as Qualidade dos leads ("Hoje").
  const todayStart = overview.since;
  const alive = and(
    eq(schema.leads.tenantId, context.tenantId),
    isNull(schema.leads.deletedAt),
    isNull(schema.leads.archivedAt),
    scope.leadScope,
    overview.narrowBranchId ? eq(schema.leads.branchId, overview.narrowBranchId) : undefined,
  );
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
    window: overview.window,
  };
}

export type BrokerWhatsAppStatus = {
  total: number;
  connected: number;
  /** First brokers still without WhatsApp, by name, to chase before the 20/10 rule. */
  notConnected: Array<{ id: string; name: string }>;
  activity: ReturnType<typeof summarizeWhatsAppActivity>;
  /**
   * Window of `activity` ("Respostas no WhatsApp"): always the last 7 days,
   * whatever the overview period, matching the `respondeu=7d` link of /conversas.
   */
  activityWindow: { start: string; end: string };
};

/**
 * Active brokers in the viewer's scope (Diretor: tenant, Gestor: unit,
 * Supervisor: team) and how many have their WhatsApp connected ("ready").
 * With `filter.branchId` a Diretor narrows it to the brokers (and their leads)
 * of one unit; the period does not change it: readiness is "now" and the
 * replies are always the last 7 days (see `activityWindow`).
 */
export async function getBrokerWhatsAppStatus(context: TenantContext, scope: ReportScope, filter?: OverviewFilter | ResolvedOverviewFilter): Promise<BrokerWhatsAppStatus> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const activityWindow = { start: sevenDaysAgo.toISOString(), end: now.toISOString() };
  const empty: BrokerWhatsAppStatus = { total: 0, connected: 0, notConnected: [], activity: summarizeWhatsAppActivity([]), activityWindow };
  const brokerScope = brokerWhatsAppMembershipScope({
    role: context.role,
    branchId: context.branchId,
    supervisedBrokerIds: scope.supervisedBrokerIds,
  });
  if (brokerScope === null) return empty;
  // No extra query without a filter: the unit is only checked when a Diretor asks for one.
  const narrowBranchId = filter ? (await overviewFilterFor(context, scope, filter, now)).narrowBranchId : null;
  const personalConnectionReady = sql<boolean>`exists (
    select 1 from ${schema.whatsappConnections}
    where ${schema.whatsappConnections.tenantId} = ${context.tenantId}
      and ${schema.whatsappConnections.userId} = ${schema.tenantMemberships.userId}
      and ${schema.whatsappConnections.status} = 'ready'
  )`;

  // Explicit source IDs identify personal messages; legacy rows without either ID use the owner and phone approximation and age out of this seven-day window.
  const rows = await getDatabase()
    .select({
      id: schema.tenantMemberships.userId,
      name: schema.user.name,
      connected: personalConnectionReady,
      // Only leads with a reply in the window: the joins keep every lead of the broker.
      leadCount: sql<number>`(count(distinct ${schema.leads.id}) filter (where ${schema.whatsappMessages.id} is not null))::int`,
    })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .leftJoin(schema.leads, and(
      eq(schema.leads.tenantId, context.tenantId),
      eq(schema.leads.corretorId, schema.tenantMemberships.userId),
      isNull(schema.leads.deletedAt),
      isNull(schema.leads.archivedAt),
      scope.leadScope,
      narrowBranchId ? eq(schema.leads.branchId, narrowBranchId) : undefined,
      personalConnectionReady,
    ))
    .leftJoin(schema.whatsappMessages, and(
      eq(schema.whatsappMessages.tenantId, context.tenantId),
      eq(schema.whatsappMessages.leadId, schema.leads.id),
      eq(schema.whatsappMessages.provider, "waha"),
      inArray(schema.whatsappMessages.direction, ["incoming", "inbound"]),
      gte(schema.whatsappMessages.sentAt, sevenDaysAgo),
      lte(schema.whatsappMessages.sentAt, now),
      notStatusBroadcastSql(schema.whatsappMessages.messageId),
      sql`not (${schema.whatsappMessages.mediaKind} is null and lower(trim(coalesce(${schema.whatsappMessages.body}, ''))) in ('', '[text]'))`,
      brokerWhatsAppMessageSourceCondition({
        tenantId: context.tenantId,
        brokerUserId: schema.tenantMemberships.userId,
        message: schema.whatsappMessages,
      }),
    ))
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId),
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.status, "active"),
      brokerScope,
      narrowBranchId ? eq(schema.tenantMemberships.branchId, narrowBranchId) : undefined,
    ))
    .groupBy(schema.tenantMemberships.userId, schema.user.name)
    .orderBy(schema.user.name);

  const notConnected = rows.filter((row) => !row.connected).map((row) => ({ id: row.id, name: row.name }));
  return {
    total: rows.length,
    connected: rows.length - notConnected.length,
    notConnected: notConnected.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).slice(0, 6),
    activity: summarizeWhatsAppActivity(rows),
    activityWindow,
  };
}

/** Resolve report scope and load the metric for Lite Inicio pages that do not render CommandCenter. */
export async function getBrokerWhatsAppStatusForContext(context: TenantContext, filter?: OverviewFilter): Promise<BrokerWhatsAppStatus> {
  const scope = await resolveReportDataScope(context);
  return getBrokerWhatsAppStatus(context, scope, filter);
}

export type CommandCenterData = Awaited<ReturnType<typeof getCommandCenterData>>;

/**
 * Everything the dashboard (the command center) shows: today's numbers, the
 * plantões running now, what needs attention and the latest leads. Lighter
 * than the old reporting dashboard: no funnel, trend or rankings here.
 * `filter` (period and, for a Diretor, a unit) is resolved once and shared by
 * the numbers, the WhatsApp cards and the recent leads.
 */
export async function getCommandCenterData(context: TenantContext, filter?: OverviewFilter) {
  const db = getDatabase();
  const scope = await resolveReportDataScope(context);
  const now = new Date();
  const overview = await resolveOverviewFilter(context, scope, filter, now);
  const branchWhere = overview.narrowBranchId ? eq(schema.leads.branchId, overview.narrowBranchId) : undefined;
  const [today, welcome, attention, recentLeads, whatsapp] = await Promise.all([
    getDashboardToday(context, now, scope, overview),
    getDashboardWelcome(context, now, { branchId: overview.narrowBranchId }),
    getAttentionSnapshot(context, 7, { branchId: overview.narrowBranchId }),
    db.select({ id: schema.leads.id, name: schema.leads.nome, status: schema.leads.status, branchName: schema.branches.name, createdAt: schema.leads.createdAt })
      .from(schema.leads)
      .leftJoin(schema.branches, and(eq(schema.leads.branchId, schema.branches.id), eq(schema.branches.tenantId, context.tenantId)))
      .where(and(eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt), scope.leadScope, branchWhere))
      .orderBy(sql`${schema.leads.createdAt} desc`)
      .limit(6),
    getBrokerWhatsAppStatus(context, scope, overview),
  ]);
  return {
    today,
    welcome,
    whatsapp,
    attention: attention.items.filter((item) => item.count > 0).map((item) => ({ ...item, tone: item.count > 5 ? "danger" as const : "warning" as const })),
    recentLeads: recentLeads.map((row) => ({ id: row.id, name: row.name, status: row.status, branchName: row.branchName, createdAt: row.createdAt.toISOString() })),
    generatedAt: new Date().toISOString(),
  };
}
