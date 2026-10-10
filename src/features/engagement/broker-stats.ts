import "server-only";

import { and, asc, count, eq, gte, inArray, isNotNull, isNull, lt, lte, notInArray, sql } from "drizzle-orm";

import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { TtlCache } from "@/shared/cache/ttl-cache";
import { getDatabase, schema } from "@/shared/db";

import { rankBroker, type BrokerOfferStats, type RankPosition } from "./ranking";

/** Rankings and stats look at a rolling week: recent enough to move, long enough to be fair. */
export const STATS_PERIOD_DAYS = 7;
/** A lead accepted this long ago without a step is the "register a step" mission. */
const STEP_MISSION_AFTER_MS = 30 * 60_000;
const NOT_COUNTED = ["CANCELLED", "LOST"];

export function statsWindow(now = new Date()) {
  return { since: new Date(now.getTime() - STATS_PERIOD_DAYS * 86_400_000), until: now };
}

/**
 * Services started (offers and direct assignments) and the median time from assignment to start, per broker.
 * A reassigned lead counts for its current broker (corretorId), even if the previous one started it.
 */
async function getTeamServiceStats(tenantId: string, window: { since: Date; until: Date }) {
  const leads = schema.leads;
  const rows = await getDatabase().select({
    brokerId: leads.corretorId,
    started: count(),
    medianStartSeconds: sql<number | null>`percentile_cont(0.5) within group (order by extract(epoch from (${leads.serviceStartedAt} - ${leads.assignedAt}))) filter (where ${leads.assignedAt} is not null and ${leads.serviceStartedAt} >= ${leads.assignedAt})`,
  }).from(leads)
    .innerJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.tenantId, leads.tenantId), eq(schema.tenantMemberships.userId, leads.corretorId)))
    .where(and(
      eq(leads.tenantId, tenantId),
      isNull(leads.deletedAt),
      isNotNull(leads.serviceStartedAt),
      gte(leads.serviceStartedAt, window.since),
      lt(leads.serviceStartedAt, window.until),
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.status, "active"),
    ))
    .groupBy(leads.corretorId);
  return new Map(rows.filter((row) => row.brokerId).map((row) => [row.brokerId!, { started: Number(row.started), medianStartSeconds: row.medianStartSeconds === null ? null : Number(row.medianStartSeconds) }]));
}

/** The team numbers change slowly: every Início of the tenant shares them for a minute. */
const teamStatsCache = new TtlCache<BrokerOfferStats[]>(60_000, 200);

/** Offers and services of every active broker: offers only cover the plantão; services also count direct assignments. */
export async function getTeamOfferStats(tenantId: string, window = statsWindow()): Promise<BrokerOfferStats[]> {
  const cached = teamStatsCache.get(tenantId);
  if (cached) return cached;
  const stats = await loadTeamStats(tenantId, window);
  teamStatsCache.set(tenantId, stats);
  return stats;
}

async function loadTeamStats(tenantId: string, window: { since: Date; until: Date }): Promise<BrokerOfferStats[]> {
  const [offerStats, serviceStats] = await Promise.all([getTeamOnlyOfferStats(tenantId, window), getTeamServiceStats(tenantId, window)]);
  const byBroker = new Map(offerStats.map((row) => [row.brokerId, row]));
  for (const [brokerId, service] of serviceStats) {
    const current = byBroker.get(brokerId) ?? { brokerId, offered: 0, accepted: 0, medianAcceptSeconds: null };
    byBroker.set(brokerId, { ...current, ...service });
  }
  return [...byBroker.values()].map((row) => ({ started: 0, medianStartSeconds: null, ...row }));
}

/** Offers received, accepted and the median time to accept of every active broker (one grouped query). */
async function getTeamOnlyOfferStats(tenantId: string, window: { since: Date; until: Date }): Promise<BrokerOfferStats[]> {
  const offers = schema.leadOffers;
  const rows = await getDatabase().select({
    brokerId: offers.brokerId,
    offered: count(),
    accepted: sql<number>`count(*) filter (where ${offers.acceptedAt} is not null)`,
    medianAcceptSeconds: sql<number | null>`percentile_cont(0.5) within group (order by extract(epoch from (${offers.acceptedAt} - ${offers.offeredAt}))) filter (where ${offers.acceptedAt} is not null)`,
  }).from(offers)
    .innerJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.tenantId, offers.tenantId), eq(schema.tenantMemberships.userId, offers.brokerId)))
    .where(and(
      eq(offers.tenantId, tenantId),
      gte(offers.offeredAt, window.since),
      lt(offers.offeredAt, window.until),
      notInArray(offers.status, NOT_COUNTED),
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.status, "active"),
    ))
    .groupBy(offers.brokerId);
  return rows.map((row) => ({
    brokerId: row.brokerId,
    offered: Number(row.offered),
    accepted: Number(row.accepted),
    medianAcceptSeconds: row.medianAcceptSeconds === null ? null : Number(row.medianAcceptSeconds),
  }));
}

/** Leads the broker accepted but never moved to a step (still "novo"/"distribuído"), oldest first. */
export async function getLeadsWithoutStep(tenantId: string, brokerId: string, now = new Date()) {
  const leads = schema.leads;
  const where = and(
    eq(leads.tenantId, tenantId),
    eq(leads.corretorId, brokerId),
    isNull(leads.deletedAt),
    isNull(leads.archivedAt),
    inArray(leads.status, ["new", "distributed"]),
    eq(leads.distributionStatus, "assigned"),
    isNotNull(leads.assignedAt),
    lte(leads.assignedAt, new Date(now.getTime() - STEP_MISSION_AFTER_MS)),
  );
  const db = getDatabase();
  const [[total], oldest] = await Promise.all([
    db.select({ total: count() }).from(leads).where(where),
    db.select({ id: leads.id, name: leads.nome }).from(leads).where(where).orderBy(asc(leads.assignedAt)).limit(1),
  ]);
  return { total: Number(total?.total ?? 0), oldest: oldest[0] ?? null };
}

export type BrokerHighlights = {
  ranks: RankPosition[];
  stats: BrokerOfferStats | null;
  /** "Register the step of X": every lead with a step, so the pipeline is right. */
  stepMission: { leadId: string; leadName: string; remaining: number } | null;
};

const journeyEnabled = async () => (await getFeatureFlag(FEATURE_FLAGS.BROKER_ENGAGEMENT).catch(() => "false")) === "true";

/** What the broker's Início shows about themself. Null while the journey flag is off. */
export async function getBrokerHighlights(tenantId: string, brokerId: string, now = new Date()): Promise<BrokerHighlights | null> {
  if (!(await journeyEnabled())) return null;
  const [team, withoutStep] = await Promise.all([getTeamOfferStats(tenantId, statsWindow(now)), getLeadsWithoutStep(tenantId, brokerId, now)]);
  return {
    ranks: rankBroker(team, brokerId),
    stats: team.find((row) => row.brokerId === brokerId) ?? null,
    stepMission: withoutStep.oldest ? { leadId: withoutStep.oldest.id, leadName: withoutStep.oldest.name, remaining: withoutStep.total } : null,
  };
}

/** The member profile (director side): numbers, positions and leads without a step. Null while the journey flag is off. */
export async function getMemberOfferRanking(tenantId: string, brokerId: string, now = new Date()) {
  if (!(await journeyEnabled())) return null;
  const [team, withoutStep] = await Promise.all([getTeamOfferStats(tenantId, statsWindow(now)), getLeadsWithoutStep(tenantId, brokerId, now)]);
  return { stats: team.find((row) => row.brokerId === brokerId) ?? null, ranks: rankBroker(team, brokerId), periodDays: STATS_PERIOD_DAYS, withoutStep: withoutStep.total };
}
