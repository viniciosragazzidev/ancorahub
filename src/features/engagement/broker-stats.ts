import "server-only";

import { and, asc, count, eq, gte, inArray, isNotNull, isNull, lt, lte, notInArray, sql } from "drizzle-orm";

import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
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

/** Offers received, accepted and the median time to accept of every active broker (one grouped query). */
export async function getTeamOfferStats(tenantId: string, window = statsWindow()): Promise<BrokerOfferStats[]> {
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
