import "server-only";

import { maskPhone } from "@/features/quotes/utils";
import { and, desc, eq, gte, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { DEFAULT_PERIOD, fillTrendDays, periodDaysAgoSql, periodStart, type PeriodValue } from "@/shared/period";

const activeLeadStatuses = ["new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;

export type BrokerDashboardData = {
  userName: string;
  branchName: string;
  availabilityStatus: "available" | "paused" | "offline";
  leads: Array<{ id: string; name: string; phone: string; source: string; status: string; createdAt: Date; lastInteractionAt: Date | null }>;
  activeLeads: Array<{ id: string; name: string; status: string; serviceStartedAt: Date | null }>;
  totals: { all: number; active: number; new: number; distributed: number; inContact: number; lost: number; converted: number };
  pendingStaleness: { oldestMinutes: number | null; overdueCount: number };
  trend: LeadTrend;
};

export async function getBrokerDashboardData(period: PeriodValue = DEFAULT_PERIOD): Promise<BrokerDashboardData> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [user, membership, leads, trendRaw] = await Promise.all([
    db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, context.userId)).limit(1),
    db.select({ availabilityStatus: schema.tenantMemberships.availabilityStatus, branchName: schema.branches.name }).from(schema.tenantMemberships).leftJoin(schema.branches, eq(schema.tenantMemberships.branchId, schema.branches.id)).where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, context.userId))).limit(1),
    db.select({ id: schema.leads.id, name: schema.leads.nome, phone: schema.leads.telefone, source: schema.leads.origem, status: schema.leads.status, createdAt: schema.leads.createdAt, assignedAt: schema.leads.assignedAt, serviceStartedAt: schema.leads.serviceStartedAt })
      .from(schema.leads)
      .innerJoin(schema.tenants, eq(schema.leads.tenantId, schema.tenants.id))
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        eq(schema.leads.corretorId, context.userId),
        isNull(schema.leads.deletedAt),
        or(
          ne(schema.leads.status, "distributed"),
          isNotNull(schema.leads.firstContactAt),
          isNull(schema.leads.assignedAt),
          gte(schema.leads.assignedAt, sql`now() - (COALESCE(NULLIF(${schema.tenants.slaFirstContactMinutes}, ''), '15')::integer * interval '1 minute')`),
        ),
      ))
      .orderBy(desc(schema.leads.createdAt)),
    // Lead trend: last 30 days grouped by date
    db
      .select({
        date: sql<string>`to_char(${schema.leads.createdAt}, 'YYYY-MM-DD')`,
        leads: sql<number>`count(*)::int`,
        converted: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')::int`,
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          eq(schema.leads.corretorId, context.userId),
          isNull(schema.leads.deletedAt),
          gte(schema.leads.createdAt, periodDaysAgoSql(period)),
        ),
      )
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ]);
  const interactions = leads.length ? await db.select({ leadId: schema.leadInteractions.leadId, createdAt: schema.leadInteractions.createdAt }).from(schema.leadInteractions).where(inArray(schema.leadInteractions.leadId, leads.map((lead) => lead.id))).orderBy(desc(schema.leadInteractions.createdAt)) : [];
  const latest = new Map<string, Date>();
  for (const interaction of interactions) if (!latest.has(interaction.leadId)) latest.set(interaction.leadId, interaction.createdAt);

  const nowMs = Date.now();
  const distributedLeads = leads.filter((lead) => lead.status === "distributed");
  const pendingStaleness = {
    oldestMinutes: distributedLeads.length > 0 && distributedLeads.some((l) => l.assignedAt)
      ? Math.round(distributedLeads.reduce((max, lead) => {
          const diff = lead.assignedAt ? nowMs - lead.assignedAt.getTime() : 0;
          return diff > max ? diff : max;
        }, 0) / 60_000)
      : null,
    overdueCount: distributedLeads.filter((lead) => lead.assignedAt && nowMs - lead.assignedAt.getTime() > 15 * 60 * 1000).length,
  };

  const trendMap = new Map(trendRaw.map((r) => [r.date, r]));
  const trend = fillTrendDays(period, trendMap);

  return {
    userName: user[0]?.name ?? "Corretor",
    branchName: membership[0]?.branchName ?? "Unidade não identificada",
    availabilityStatus: membership[0]?.availabilityStatus ?? "available",
    leads: leads.map((lead) => ({ ...lead, phone: maskPhone(lead.phone), lastInteractionAt: latest.get(lead.id) ?? null })),
    activeLeads: leads.filter((lead) => (activeLeadStatuses as readonly string[]).includes(lead.status) && lead.status !== "new" && lead.status !== "distributed").map((lead) => ({ id: lead.id, name: lead.name, status: lead.status, serviceStartedAt: lead.serviceStartedAt })),
    totals: {
      all: leads.length,
      active: leads.filter((lead) => (activeLeadStatuses as readonly string[]).includes(lead.status)).length,
      new: leads.filter((lead) => lead.status === "new").length,
      distributed: distributedLeads.length,
      inContact: leads.filter((lead) => lead.status === "in_contact").length,
      lost: leads.filter((lead) => lead.status === "lost").length,
      converted: leads.filter((lead) => lead.status === "converted").length,
    },
    pendingStaleness,
    trend,
  };
}

export type ManagerDashboardData = {
  branchName: string;
  teamSize: number;
  activeMembers: number;
  leadsTotal: number;
  newLeads: number;
  inContact: number;
  unassigned: number;
  unworked: number;
  stalled: number;
  branchId: string;
  autoDistribute: boolean;
  trend: LeadTrend;
};

export async function getManagerDashboardData(period: PeriodValue = DEFAULT_PERIOD): Promise<ManagerDashboardData> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  // OPTIMIZED: Use SQL aggregations instead of fetching all leads
  const [branch, members, countsByStatus, staleCount, stalledCount, trendRaw] = await Promise.all([
    db.select({ autoDistribute: schema.branches.autoDistribute, branchName: schema.branches.name }).from(schema.branches).where(and(eq(schema.branches.id, context.branchId!), eq(schema.branches.tenantId, context.tenantId))).limit(1),
    db.select({ userId: schema.tenantMemberships.userId, status: schema.tenantMemberships.status }).from(schema.tenantMemberships).where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.branchId, context.branchId!), eq(schema.tenantMemberships.role, "broker"))),
    // Aggregated counts by status — no need to fetch all rows
    db.select({
      status: schema.leads.status,
      count: sql<number>`count(*)::int`,
    })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.branchId, context.branchId!), isNull(schema.leads.deletedAt)))
      .groupBy(schema.leads.status),
    // Unworked: distributed leads not contacted within SLA
    db.select({ count: sql<number>`count(*)::int` })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        eq(schema.leads.branchId, context.branchId!),
        eq(schema.leads.status, "distributed"),
        isNotNull(schema.leads.assignedAt),
        sql`${schema.leads.assignedAt} < now() - interval '15 minutes'`,
        isNull(schema.leads.firstContactAt),
      )),
    // Stalled: active leads stuck in same stage > 3 days
    db.select({ count: sql<number>`count(*)::int` })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        eq(schema.leads.branchId, context.branchId!),
        inArray(schema.leads.status, [...activeLeadStatuses]),
        isNotNull(schema.leads.stageEnteredAt),
        sql`${schema.leads.stageEnteredAt} < now() - interval '3 days'`,
      )),
    // Lead trend: last 30 days grouped by date
    db
      .select({
        date: sql<string>`to_char(${schema.leads.createdAt}, 'YYYY-MM-DD')`,
        leads: sql<number>`count(*)::int`,
        converted: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')::int`,
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          eq(schema.leads.branchId, context.branchId!),
          isNull(schema.leads.deletedAt),
          gte(schema.leads.createdAt, periodDaysAgoSql(period)),
        ),
      )
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ]);

  // Build totals from aggregated status counts (no full-row fetch)
  const statusMap = new Map(countsByStatus.map((r) => [r.status, r.count]));
  const leadsTotal = countsByStatus.reduce((sum, r) => sum + r.count, 0);
  const activeCount = [...activeLeadStatuses].reduce((sum, s) => sum + (statusMap.get(s) ?? 0), 0);

  const trendMap = new Map(trendRaw.map((r) => [r.date, r]));
  const trend = fillTrendDays(period, trendMap);

  return {
    branchName: branch[0]?.branchName ?? "Unidade não identificada",
    teamSize: members.length,
    activeMembers: members.filter((member) => member.status === "active").length,
    leadsTotal,
    newLeads: statusMap.get("new") ?? 0,
    inContact: statusMap.get("in_contact") ?? 0,
    unassigned: statusMap.get("new") ?? 0, // new = unassigned in this context
    unworked: staleCount[0]?.count ?? 0,
    stalled: stalledCount[0]?.count ?? 0,
    branchId: context.branchId!,
    autoDistribute: branch[0]?.autoDistribute ?? true,
    trend,
  };
}

export type LeadTrend = Array<{ date: string; leads: number; converted: number }>;

export type DirectorDashboardData = {
  user: { name: string; email: string; image: string | null };
  tenant: { name: string; slug: string; legalName: string | null; cnpj: string | null; subscriptionPlan: string };
  totals: { leads: number; activeLeads: number; converted: number; branches: number; members: number; activeBrokers: number; unworked: number; stalled: number };
  funnel: Array<{ stage: string; volume: number }>;
  branches: Array<{ name: string; leads: number; activeLeads: number; conversion: string }>;
  trend: LeadTrend;
};

export async function getDirectorDashboardData(period: PeriodValue = DEFAULT_PERIOD): Promise<DirectorDashboardData> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  // OPTIMIZED: Use SQL aggregations instead of fetching ALL leads
  const [user, tenant, statusCounts, activeCount, unworkedCount, stalledCount, convertedCount, branchStats, members, trendRaw] = await Promise.all([
    db.select({ name: schema.user.name, email: schema.user.email, image: schema.user.image }).from(schema.user).where(eq(schema.user.id, context.userId)).limit(1),
    db.select({ name: schema.tenants.name, slug: schema.tenants.slug, legalName: schema.tenants.legalName, cnpj: schema.tenants.cnpj, subscriptionPlan: schema.tenants.subscriptionPlan }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1),
    // Aggregated counts by status — no full-row fetch
    db.select({
      status: schema.leads.status,
      count: sql<number>`count(*)::int`,
    })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt)))
      .groupBy(schema.leads.status),
    // Active count (single query)
    db.select({ count: sql<number>`count(*)::int` })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt), inArray(schema.leads.status, [...activeLeadStatuses]))),
    // Unworked: distributed leads not contacted within SLA
    db.select({ count: sql<number>`count(*)::int` })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        eq(schema.leads.status, "distributed"),
        isNotNull(schema.leads.assignedAt),
        sql`${schema.leads.assignedAt} < now() - interval '15 minutes'`,
        isNull(schema.leads.firstContactAt),
      )),
    // Stalled: active leads stuck in same stage > 3 days
    db.select({ count: sql<number>`count(*)::int` })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        inArray(schema.leads.status, [...activeLeadStatuses]),
        isNotNull(schema.leads.stageEnteredAt),
        sql`${schema.leads.stageEnteredAt} < now() - interval '3 days'`,
      )),
    // Converted count
    db.select({ count: sql<number>`count(*)::int` })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt), eq(schema.leads.status, "converted"))),
    // Per-branch aggregated stats
    db.select({
      branchId: schema.leads.branchId,
      status: schema.leads.status,
      count: sql<number>`count(*)::int`,
    })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt)))
      .groupBy(schema.leads.branchId, schema.leads.status),
    db.select({ role: schema.tenantMemberships.role, status: schema.tenantMemberships.status }).from(schema.tenantMemberships).where(eq(schema.tenantMemberships.tenantId, context.tenantId)),
    // Lead trend: last 30 days grouped by date
    db
      .select({
        date: sql<string>`to_char(${schema.leads.createdAt}, 'YYYY-MM-DD')`,
        leads: sql<number>`count(*)::int`,
        converted: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')::int`,
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          isNull(schema.leads.deletedAt),
          gte(schema.leads.createdAt, periodDaysAgoSql(period)),
        ),
      )
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ]);

  if (!user[0] || !tenant[0]) throw new Error("User or tenant not found");

  // Build totals from aggregated data
  const totalLeads = statusCounts.reduce((sum, r) => sum + r.count, 0);
  const statusMap = new Map(statusCounts.map((r) => [r.status, r.count]));

  // Build funnel from status counts
  const stageMap: Record<string, string> = {
    new: "Novo", distributed: "Novo", in_contact: "Contato",
    quote_sent: "Cotação", negotiation: "Negociação", converted: "Conversão",
    documentation_pending: "Em análise", under_analysis: "Em análise",
    lost: "Em análise",
  };
  const stageNames = ["Novo", "Contato", "Cotação", "Negociação", "Conversão"];
  const funnelVolumeMap = new Map<string, number>();
  for (const r of statusCounts) {
    const stageName = stageMap[r.status] ?? "Em análise";
    funnelVolumeMap.set(stageName, (funnelVolumeMap.get(stageName) ?? 0) + r.count);
  }
  const funnel = stageNames.map((name) => ({ stage: name, volume: funnelVolumeMap.get(name) ?? 0 }));

  // Build per-branch stats from aggregated data
  const branches = await db.select({ id: schema.branches.id, name: schema.branches.name }).from(schema.branches).where(eq(schema.branches.tenantId, context.tenantId));

  const branchLeadsMap = new Map<string, Map<string, number>>();
  for (const r of branchStats) {
    const bid = r.branchId ?? "__none__";
    if (!branchLeadsMap.has(bid)) branchLeadsMap.set(bid, new Map());
    branchLeadsMap.get(bid)!.set(r.status, r.count);
  }

  const branchItems = branches.map((branch) => {
    const sm = branchLeadsMap.get(branch.id) ?? new Map();
    let branchTotal = 0;
    let branchActive = 0;
    let branchConverted = 0;
    for (const [status, count] of sm) {
      branchTotal += count;
      if ((activeLeadStatuses as readonly string[]).includes(status as typeof activeLeadStatuses[number])) branchActive += count;
      if (status === "converted") branchConverted += count;
    }
    return {
      name: branch.name,
      leads: branchTotal,
      activeLeads: branchActive,
      conversion: branchTotal ? `${((branchConverted / branchTotal) * 100).toFixed(1)}%` : "0,0%",
    };
  });

  const trendMap = new Map(trendRaw.map((r) => [r.date, r]));
  const trend = fillTrendDays(period, trendMap);

  return {
    user: user[0],
    tenant: tenant[0],
    totals: {
      leads: totalLeads,
      activeLeads: activeCount[0]?.count ?? 0,
      converted: convertedCount[0]?.count ?? 0,
      branches: branches.length,
      members: members.length,
      activeBrokers: members.filter((member) => member.role === "broker" && member.status === "active").length,
      unworked: unworkedCount[0]?.count ?? 0,
      stalled: stalledCount[0]?.count ?? 0,
    },
    funnel,
    trend,
    branches: branchItems,
  };
}

export type MarketingDashboardData = {
  user: { name: string; email: string };
  tenant: { name: string };
  totals: {
    metaCampaigns: number;
    activeCampaigns: number;
    metaAds: number;
    activeAds: number;
    leadsTotal: number;
    qualifiedLeads: number;
    convertedLeads: number;
    unroutedCampaigns: number;
  };
  funnel: Array<{ stage: string; volume: number }>;
  sources: Array<{ name: string; count: number; percentage: string }>;
  campaigns: Array<{
    id: string;
    campaignId: string;
    name: string;
    status: string;
    queueName: string | null;
    leadsCount: number;
  }>;
  trend: LeadTrend;
};

export async function getMarketingDashboardData(period: PeriodValue = DEFAULT_PERIOD): Promise<MarketingDashboardData> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const activeConn = await db
    .select({ id: schema.metaConnections.id })
    .from(schema.metaConnections)
    .where(and(eq(schema.metaConnections.tenantId, context.tenantId), eq(schema.metaConnections.status, "connected")))
    .limit(1);

  const isMetaConnected = activeConn.length > 0;

  // OPTIMIZED: Use SQL aggregations for lead counts instead of fetching all leads
  const [user, tenant, statusCounts, sourceCounts, activeCampaignsCount, activeAdsCount, campaignRoutes, rawCampaigns, rawAds, trendRaw] = await Promise.all([
    db.select({ name: schema.user.name, email: schema.user.email }).from(schema.user).where(eq(schema.user.id, context.userId)).limit(1),
    db.select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1),
    // Aggregated counts by status — no full-row fetch
    db.select({
      status: schema.leads.status,
      count: sql<number>`count(*)::int`,
    })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt)))
      .groupBy(schema.leads.status),
    // Aggregated source counts
    db.select({
      origem: sql<string>`COALESCE(${schema.leads.origem}, 'Não identificada')`,
      count: sql<number>`count(*)::int`,
    })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt)))
      .groupBy(sql`COALESCE(${schema.leads.origem}, 'Não identificada')`),
    // Active campaigns count
    isMetaConnected
      ? db.select({ count: sql<number>`count(*)::int` })
          .from(schema.metaCampaigns)
          .innerJoin(schema.metaAdAccounts, and(eq(schema.metaCampaigns.adAccountId, schema.metaAdAccounts.adAccountId), eq(schema.metaCampaigns.tenantId, schema.metaAdAccounts.tenantId)))
          .where(and(eq(schema.metaCampaigns.tenantId, context.tenantId), eq(schema.metaAdAccounts.status, "active"), sql`${schema.metaCampaigns.status} != 'ARCHIVED'`, sql`${schema.metaCampaigns.status} = 'ACTIVE'`))
      : Promise.resolve([{ count: 0 }]),
    // Active ads count
    isMetaConnected
      ? db.select({ count: sql<number>`count(*)::int` }).from(schema.metaAds).where(and(eq(schema.metaAds.tenantId, context.tenantId), sql`${schema.metaAds.status} = 'ACTIVE'`))
      : Promise.resolve([{ count: 0 }]),
    // All campaign IDs with routes (for unrouted count + details)
    db.select({ campaignId: schema.metaCampaignQueueRoutes.campaignId, queueId: schema.metaCampaignQueueRoutes.queueId, queueName: schema.leadQueues.name, enabled: schema.metaCampaignQueueRoutes.enabled })
      .from(schema.metaCampaignQueueRoutes)
      .leftJoin(schema.leadQueues, eq(schema.metaCampaignQueueRoutes.queueId, schema.leadQueues.id))
      .where(eq(schema.metaCampaignQueueRoutes.tenantId, context.tenantId)),
    // Campaigns (only essential fields)
    isMetaConnected
      ? db
          .select({ id: schema.metaCampaigns.id, campaignId: schema.metaCampaigns.campaignId, name: schema.metaCampaigns.name, status: schema.metaCampaigns.status })
          .from(schema.metaCampaigns)
          .innerJoin(
            schema.metaAdAccounts,
            and(
              eq(schema.metaCampaigns.adAccountId, schema.metaAdAccounts.adAccountId),
              eq(schema.metaCampaigns.tenantId, schema.metaAdAccounts.tenantId)
            )
          )
          .where(
            and(
              eq(schema.metaCampaigns.tenantId, context.tenantId),
              eq(schema.metaAdAccounts.status, "active"),
              sql`${schema.metaCampaigns.status} != 'ARCHIVED'`
            )
          )
      : Promise.resolve([]),
    // Ads (only essential fields)
    isMetaConnected
      ? db.select({ id: schema.metaAds.id, adId: schema.metaAds.adId, name: schema.metaAds.name, status: schema.metaAds.status }).from(schema.metaAds).where(and(eq(schema.metaAds.tenantId, context.tenantId), sql`${schema.metaAds.status} != 'inactive'`))
      : Promise.resolve([]),
    // Lead trend: last 30 days grouped by date
    db.select({
      date: sql<string>`to_char(${schema.leads.createdAt}, 'YYYY-MM-DD')`,
      leads: sql<number>`count(*)::int`,
      converted: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')::int`,
    })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt), gte(schema.leads.createdAt, periodDaysAgoSql(period))))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ]);

  const campaigns = rawCampaigns;
  const ads = rawAds;

  if (!user[0] || !tenant[0]) throw new Error("User or tenant not found");

  const routeMap = new Map(campaignRoutes.map((r) => [r.campaignId, r]));
  const unroutedCampaigns = campaigns.filter((c) => !routeMap.has(c.campaignId) || !routeMap.get(c.campaignId)?.enabled).length;

  // Aggregated totals from status counts
  const statusMap = new Map(statusCounts.map((r) => [r.status, r.count]));
  const totalLeads = statusCounts.reduce((sum, r) => sum + r.count, 0);
  const qualifiedStatuses = ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis", "converted"] as const;
  const qualifiedLeads = qualifiedStatuses.reduce((sum, s) => sum + (statusMap.get(s) ?? 0), 0);
  const convertedLeads = statusMap.get("converted") ?? 0;

  // Sources from aggregated source counts
  const totalSourcesCount = totalLeads || 1;
  const sources = sourceCounts.map((r) => ({
    name: r.origem,
    count: r.count,
    percentage: `${((r.count / totalSourcesCount) * 100).toFixed(1)}%`,
  })).sort((a, b) => b.count - a.count);

  // Campaign leads counts from aggregated data (only for displayed campaigns)
  // We need per-campaign counts. Since campaigns is typically small (< 50), we do a targeted query
  const campaignIds = campaigns.map((c) => c.campaignId);
  const leadsPerCampaignRows = campaignIds.length
    ? await db.select({
        metaCampaignId: schema.leads.metaCampaignId,
        count: sql<number>`count(*)::int`,
      })
        .from(schema.leads)
        .where(and(
          eq(schema.leads.tenantId, context.tenantId),
          isNull(schema.leads.deletedAt),
          inArray(schema.leads.metaCampaignId, campaignIds),
        ))
        .groupBy(schema.leads.metaCampaignId)
    : [];
  const leadsPerCampaignMap = new Map(leadsPerCampaignRows.map((r) => [r.metaCampaignId, r.count]));

  const campaignItems = campaigns.map((c) => {
    const route = routeMap.get(c.campaignId);
    return {
      id: c.id,
      campaignId: c.campaignId,
      name: c.name,
      status: c.status,
      queueName: route?.enabled ? route.queueName ?? "Fila padrão" : "Sem entrada",
      leadsCount: leadsPerCampaignMap.get(c.campaignId) ?? 0,
    };
  });

  // Funnel from status counts
  const stageMap: Record<string, string> = {
    new: "Novo", distributed: "Novo", in_contact: "Contato",
    quote_sent: "Cotação", negotiation: "Negociação", converted: "Conversão",
    documentation_pending: "Em análise", under_analysis: "Em análise",
    lost: "Em análise",
  };
  const stageNames = ["Novo", "Contato", "Cotação", "Negociação", "Conversão"];
  const funnelVolumeMap = new Map<string, number>();
  for (const r of statusCounts) {
    const stageName = stageMap[r.status] ?? "Em análise";
    funnelVolumeMap.set(stageName, (funnelVolumeMap.get(stageName) ?? 0) + r.count);
  }
  const funnel = stageNames.map((name) => ({ stage: name, volume: funnelVolumeMap.get(name) ?? 0 }));

  const trendMap = new Map(trendRaw.map((r) => [r.date, r]));
  const trend = fillTrendDays(period, trendMap);

  return {
    user: user[0],
    tenant: tenant[0],
    totals: {
      metaCampaigns: campaigns.length,
      activeCampaigns: activeCampaignsCount[0]?.count ?? 0,
      metaAds: ads.length,
      activeAds: activeAdsCount[0]?.count ?? 0,
      leadsTotal: totalLeads,
      qualifiedLeads,
      convertedLeads,
      unroutedCampaigns,
    },
    funnel,
    sources,
    campaigns: campaignItems,
    trend,
  };
}
