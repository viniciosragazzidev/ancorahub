import "server-only";

import { and, eq, gte, lte, inArray, isNull, isNotNull, count, avg, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { percentage } from "@/features/reports/metrics/metrics-math";

export type BrokerDailySummaryItem = {
  brokerId: string;
  brokerName: string;
  brokerEmail: string;
  branchId: string | null;
  branchName: string | null;
  availabilityStatus: "available" | "busy" | "break" | "offline";
  leadsReceived: number;
  activeAttending: number;
  unstartedLeads: number;
  lostLeads: number;
  convertedLeads: number;
  conversionRate: number;
  avgFirstContactMinutes: number | null;
  offersReceived: number;
  offersAccepted: number;
  offersExpired: number;
  redistributedLeads: number;
  redistributionRate: number;
  avgOfferResponseMinutes: number | null;
};

export type BrokerDailySummaryAggregate = {
  totalBrokers: number;
  totalReceived: number;
  totalActive: number;
  totalUnstarted: number;
  totalLost: number;
  totalConverted: number;
  teamConversionRate: number;
  avgTeamResponseMinutes: number | null;
  items: BrokerDailySummaryItem[];
};

const activeStatuses = [
  "new",
  "distributed",
  "in_contact",
  "quote_sent",
  "negotiation",
  "documentation_pending",
  "under_analysis",
] as const;

export async function fetchBrokerDailySummary(
  tenantId: string,
  options: {
    startDate: Date;
    endDate: Date;
    branchId?: string | null;
  },
): Promise<BrokerDailySummaryAggregate> {
  const db = getDatabase();

  // 1. Fetch active brokers in tenant/branch scope
  const branchCondition = options.branchId
    ? eq(schema.tenantMemberships.branchId, options.branchId)
    : undefined;

  const brokers = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      branchId: schema.tenantMemberships.branchId,
      branchName: schema.branches.name,
      availabilityStatus: schema.tenantMemberships.availabilityStatus,
    })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .leftJoin(schema.branches, eq(schema.tenantMemberships.branchId, schema.branches.id))
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, tenantId),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
        eq(schema.user.active, true),
        branchCondition,
      ),
    );

  if (brokers.length === 0) {
    return {
      totalBrokers: 0,
      totalReceived: 0,
      totalActive: 0,
      totalUnstarted: 0,
      totalLost: 0,
      totalConverted: 0,
      teamConversionRate: 0,
      avgTeamResponseMinutes: null,
      items: [],
    };
  }

  const brokerIds = brokers.map((b) => b.id);

  // 2. Query Leads received in date range
  const receivedLeads = await db
    .select({
      corretorId: schema.leads.corretorId,
      count: count(schema.leads.id),
      avgLatency: avg(schema.leads.firstContactLatencySeconds),
    })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.tenantId, tenantId),
        isNull(schema.leads.deletedAt),
        inArray(schema.leads.corretorId, brokerIds),
        // “Recebidos” is based on the moment the lead was assigned to the
        // broker, not when the lead record was originally created/imported.
        // A lead created yesterday and distributed today must count today.
        isNotNull(schema.leads.assignedAt),
        gte(schema.leads.assignedAt, options.startDate),
        lte(schema.leads.assignedAt, options.endDate),
      ),
    )
    .groupBy(schema.leads.corretorId);

  // 3. Query Active Attending Leads currently
  const activeLeads = await db
    .select({
      corretorId: schema.leads.corretorId,
      count: count(schema.leads.id),
    })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.tenantId, tenantId),
        isNull(schema.leads.deletedAt),
        inArray(schema.leads.corretorId, brokerIds),
        inArray(schema.leads.status, activeStatuses),
      ),
    )
    .groupBy(schema.leads.corretorId);

  // 4. Query Unstarted Leads (Assigned but no first contact yet)
  const unstartedLeads = await db
    .select({
      corretorId: schema.leads.corretorId,
      count: count(schema.leads.id),
    })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.tenantId, tenantId),
        isNull(schema.leads.deletedAt),
        inArray(schema.leads.corretorId, brokerIds),
        inArray(schema.leads.status, activeStatuses),
        isNull(schema.leads.firstContactAt),
      ),
    )
    .groupBy(schema.leads.corretorId);

  // 5. Query Lost Leads in date range
  const lostLeads = await db
    .select({
      corretorId: schema.leads.corretorId,
      count: count(schema.leads.id),
    })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.tenantId, tenantId),
        isNull(schema.leads.deletedAt),
        inArray(schema.leads.corretorId, brokerIds),
        eq(schema.leads.status, "lost"),
        gte(schema.leads.updatedAt, options.startDate),
        lte(schema.leads.updatedAt, options.endDate),
      ),
    )
    .groupBy(schema.leads.corretorId);

  // 6. Query Converted Leads in date range
  const convertedLeads = await db
    .select({
      corretorId: schema.leads.corretorId,
      count: count(schema.leads.id),
    })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.tenantId, tenantId),
        isNull(schema.leads.deletedAt),
        inArray(schema.leads.corretorId, brokerIds),
        eq(schema.leads.status, "converted"),
        gte(schema.leads.updatedAt, options.startDate),
        lte(schema.leads.updatedAt, options.endDate),
      ),
    )
    .groupBy(schema.leads.corretorId);

  const offerStats = await db
    .select({
      brokerId: schema.leadOffers.brokerId,
      offersReceived: count(schema.leadOffers.id),
      offersAccepted: sql<number>`count(*) filter (where ${schema.leadOffers.acceptedAt} is not null)`,
      offersExpired: sql<number>`count(*) filter (where ${schema.leadOffers.status} = 'EXPIRED')`,
      avgResponseSeconds: sql<number>`avg(extract(epoch from (${schema.leadOffers.acceptedAt} - ${schema.leadOffers.offeredAt}))) filter (where ${schema.leadOffers.acceptedAt} is not null)`,
    })
    .from(schema.leadOffers)
    .where(and(eq(schema.leadOffers.tenantId, tenantId), inArray(schema.leadOffers.brokerId, brokerIds), gte(schema.leadOffers.offeredAt, options.startDate), lte(schema.leadOffers.offeredAt, options.endDate)))
    .groupBy(schema.leadOffers.brokerId);

  const redistributionStats = await db
    .select({ brokerId: schema.leadDistributionEvents.previousOwnerId, count: count(schema.leadDistributionEvents.id) })
    .from(schema.leadDistributionEvents)
    .where(and(eq(schema.leadDistributionEvents.tenantId, tenantId), inArray(schema.leadDistributionEvents.previousOwnerId, brokerIds), eq(schema.leadDistributionEvents.source, "redistribution"), gte(schema.leadDistributionEvents.createdAt, options.startDate), lte(schema.leadDistributionEvents.createdAt, options.endDate)))
    .groupBy(schema.leadDistributionEvents.previousOwnerId);

  // Maps for fast aggregation
  const receivedMap = new Map(receivedLeads.map((r) => [r.corretorId!, { count: Number(r.count), avgLatency: r.avgLatency ? Number(r.avgLatency) : null }]));
  const activeMap = new Map(activeLeads.map((a) => [a.corretorId!, Number(a.count)]));
  const unstartedMap = new Map(unstartedLeads.map((u) => [u.corretorId!, Number(u.count)]));
  const lostMap = new Map(lostLeads.map((l) => [l.corretorId!, Number(l.count)]));
  const convertedMap = new Map(convertedLeads.map((c) => [c.corretorId!, Number(c.count)]));
  const offerMap = new Map(offerStats.map((o) => [o.brokerId, { offersReceived: Number(o.offersReceived), offersAccepted: Number(o.offersAccepted), offersExpired: Number(o.offersExpired), avgResponseMinutes: o.avgResponseSeconds ? Math.round(Number(o.avgResponseSeconds) / 60) : null }]));
  const redistributionMap = new Map(redistributionStats.map((r) => [r.brokerId!, Number(r.count)]));

  let totalReceived = 0;
  let totalActive = 0;
  let totalUnstarted = 0;
  let totalLost = 0;
  let totalConverted = 0;
  let latencySumSeconds = 0;
  let latencyCount = 0;

  const items: BrokerDailySummaryItem[] = brokers.map((broker) => {
    const rec = receivedMap.get(broker.id);
    const recCount = rec?.count ?? 0;
    const actCount = activeMap.get(broker.id) ?? 0;
    const unstartedCount = unstartedMap.get(broker.id) ?? 0;
    const lostCount = lostMap.get(broker.id) ?? 0;
    const convCount = convertedMap.get(broker.id) ?? 0;

    totalReceived += recCount;
    totalActive += actCount;
    totalUnstarted += unstartedCount;
    totalLost += lostCount;
    totalConverted += convCount;

    if (rec?.avgLatency !== null && rec?.avgLatency !== undefined) {
      latencySumSeconds += rec.avgLatency * recCount;
      latencyCount += recCount;
    }

    const conversionRate = percentage(convCount, recCount);
    const avgFirstContactMinutes = rec?.avgLatency ? Math.round(rec.avgLatency / 60) : null;
    const offers = offerMap.get(broker.id) ?? { offersReceived: 0, offersAccepted: 0, offersExpired: 0, avgResponseMinutes: null };
    const redistributedLeads = redistributionMap.get(broker.id) ?? 0;

    return {
      brokerId: broker.id,
      brokerName: broker.name,
      brokerEmail: broker.email,
      branchId: broker.branchId,
      branchName: broker.branchName,
      availabilityStatus: broker.availabilityStatus as any,
      leadsReceived: recCount,
      activeAttending: actCount,
      unstartedLeads: unstartedCount,
      lostLeads: lostCount,
      convertedLeads: convCount,
      conversionRate,
      avgFirstContactMinutes,
      offersReceived: offers.offersReceived,
      offersAccepted: offers.offersAccepted,
      offersExpired: offers.offersExpired,
      redistributedLeads,
      redistributionRate: percentage(redistributedLeads, recCount),
      avgOfferResponseMinutes: offers.avgResponseMinutes,
    };
  });

  // Sort by received leads descending
  items.sort((a, b) => b.leadsReceived - a.leadsReceived || b.convertedLeads - a.convertedLeads);

  const teamConversionRate = totalReceived > 0 ? Math.round((totalConverted / totalReceived) * 1000) / 10 : 0;
  const avgTeamResponseMinutes = latencyCount > 0 ? Math.round(latencySumSeconds / latencyCount / 60) : null;

  return {
    totalBrokers: brokers.length,
    totalReceived,
    totalActive,
    totalUnstarted,
    totalLost,
    totalConverted,
    teamConversionRate,
    avgTeamResponseMinutes,
    items,
  };
}
