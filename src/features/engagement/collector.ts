import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, count, eq, gte, inArray, isNotNull, isNull, lt, min, or } from "drizzle-orm";

import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

import { resolveRules, type EngagementRuleKey } from "./catalog";
import { applyDailyCaps, capKey, periodDay, scoreFastAccept, scoreFirstContact, scorePresence, scoreReturnOnTime, scoreServiceNote, type PointsCandidate } from "./scoring";

const SOURCE = "points";
/** Overlap with the previous run: late commits are caught, the unique key absorbs repeats. */
const OVERLAP_MS = 5 * 60_000;
/** First run of a tenant looks back this far (no backfill of old history). */
const FIRST_RUN_LOOKBACK_MS = 60 * 60_000;
const MAX_ROWS = 2_000;
const OUTBOUND = ["outgoing", "outbound"];
/** Messages typed by a person (CRM, coexistence phone); automations use assistant/system. */
const HUMAN_SENDER = or(isNull(schema.whatsappMessages.senderRole), inArray(schema.whatsappMessages.senderRole, ["user", "agent"]));

type Window = { since: Date; until: Date };
/**
 * Each source reads in time order, at most MAX_ROWS. When a page is full, `cutoff`
 * is its last timestamp: the watermark stops there so the rest is read next run.
 */
type SourceResult = { candidates: PointsCandidate[]; cutoff: Date | null };
const NONE: SourceResult = { candidates: [], cutoff: null };
const cutoffOf = <T>(rows: T[], at: (row: T) => Date | null) => (rows.length >= MAX_ROWS ? at(rows[rows.length - 1]!) : null);

async function firstContactCandidates(tenantId: string, window: Window, slaMinutes: number, rules: ReturnType<typeof resolveRules>): Promise<SourceResult> {
  if (!rules["contact.first"].enabled) return NONE;
  const db = getDatabase();
  const messages = schema.whatsappMessages;
  const touched = await db.select({ leadId: messages.leadId, sentAt: messages.sentAt }).from(messages).where(and(
    eq(messages.tenantId, tenantId),
    gte(messages.sentAt, window.since),
    lt(messages.sentAt, window.until),
    inArray(messages.direction, OUTBOUND),
    HUMAN_SENDER,
    isNotNull(messages.leadId),
  )).orderBy(asc(messages.sentAt)).limit(MAX_ROWS);
  const cutoff = cutoffOf(touched, (row) => row.sentAt);
  const leadIds = [...new Set(touched.map((row) => row.leadId).filter((id): id is string => Boolean(id)))];
  if (!leadIds.length) return NONE;

  // First human message after the current assignment, over the whole history of the lead.
  const rows = await db.select({
    leadId: schema.leads.id,
    brokerId: schema.leads.corretorId,
    assignedAt: schema.leads.assignedAt,
    firstOutboundAt: min(messages.sentAt),
  }).from(schema.leads)
    .innerJoin(messages, and(eq(messages.leadId, schema.leads.id), eq(messages.tenantId, tenantId), inArray(messages.direction, OUTBOUND), HUMAN_SENDER, gte(messages.sentAt, schema.leads.assignedAt)))
    .where(and(eq(schema.leads.tenantId, tenantId), inArray(schema.leads.id, leadIds), isNotNull(schema.leads.corretorId), isNotNull(schema.leads.assignedAt), isNull(schema.leads.deletedAt)))
    .groupBy(schema.leads.id, schema.leads.corretorId, schema.leads.assignedAt);

  return { cutoff, candidates: rows.flatMap((row) => {
    if (!row.brokerId || !row.assignedAt || !row.firstOutboundAt) return [];
    const firstOutboundAt = new Date(row.firstOutboundAt);
    // Only a first contact that happened in this window (older ones were scored before or predate the feature).
    if (firstOutboundAt < window.since) return [];
    const candidate = scoreFirstContact({ leadId: row.leadId, brokerId: row.brokerId, assignedAt: row.assignedAt, firstOutboundAt, slaMinutes }, rules["contact.first"]);
    return candidate ? [candidate] : [];
  }) };
}

async function fastAcceptCandidates(tenantId: string, window: Window, rules: ReturnType<typeof resolveRules>): Promise<SourceResult> {
  if (!rules["offer.fast_accept"].enabled) return NONE;
  const offers = schema.leadOffers;
  const rows = await getDatabase().select({ id: offers.id, leadId: offers.leadId, brokerId: offers.brokerId, offeredAt: offers.offeredAt, acceptedAt: offers.acceptedAt })
    .from(offers)
    .where(and(eq(offers.tenantId, tenantId), isNotNull(offers.acceptedAt), gte(offers.acceptedAt, window.since), lt(offers.acceptedAt, window.until)))
    .orderBy(asc(offers.acceptedAt))
    .limit(MAX_ROWS);
  return { cutoff: cutoffOf(rows, (row) => row.acceptedAt), candidates: rows.flatMap((row) => {
    const candidate = row.acceptedAt ? scoreFastAccept({ offerId: row.id, leadId: row.leadId, brokerId: row.brokerId, offeredAt: row.offeredAt, acceptedAt: row.acceptedAt }, rules["offer.fast_accept"]) : null;
    return candidate ? [candidate] : [];
  }) };
}

async function returnCandidates(tenantId: string, window: Window, rules: ReturnType<typeof resolveRules>): Promise<SourceResult> {
  if (!rules["return.on_time"].enabled) return NONE;
  const tasks = schema.leadTasks;
  const rows = await getDatabase().select({ id: tasks.id, leadId: tasks.leadId, assignedTo: tasks.assignedTo, createdBy: tasks.createdBy, createdAt: tasks.createdAt, dueAt: tasks.dueAt, completedAt: tasks.completedAt })
    .from(tasks)
    .where(and(eq(tasks.tenantId, tenantId), isNotNull(tasks.completedAt), gte(tasks.completedAt, window.since), lt(tasks.completedAt, window.until), isNotNull(tasks.assignedTo), isNotNull(tasks.dueAt)))
    .orderBy(asc(tasks.completedAt))
    .limit(MAX_ROWS);
  return { cutoff: cutoffOf(rows, (row) => row.completedAt), candidates: rows.flatMap((row) => {
    if (!row.assignedTo || !row.dueAt || !row.completedAt) return [];
    const candidate = scoreReturnOnTime({ taskId: row.id, leadId: row.leadId, assignedTo: row.assignedTo, createdBy: row.createdBy, createdAt: row.createdAt, dueAt: row.dueAt, completedAt: row.completedAt }, rules["return.on_time"]);
    return candidate ? [candidate] : [];
  }) };
}

async function noteCandidates(tenantId: string, window: Window, rules: ReturnType<typeof resolveRules>): Promise<SourceResult> {
  if (!rules["note.service"].enabled) return NONE;
  const interactions = schema.leadInteractions;
  const rows = await getDatabase().select({ id: interactions.id, leadId: interactions.leadId, userId: interactions.userId, content: interactions.conteudo, createdAt: interactions.createdAt })
    .from(interactions)
    .innerJoin(schema.leads, eq(schema.leads.id, interactions.leadId))
    .where(and(
      eq(interactions.tipo, "note"),
      gte(interactions.createdAt, window.since),
      lt(interactions.createdAt, window.until),
      eq(schema.leads.tenantId, tenantId),
      // Only a note on the broker's own lead.
      eq(schema.leads.corretorId, interactions.userId),
    ))
    .orderBy(asc(interactions.createdAt))
    .limit(MAX_ROWS);
  return { cutoff: cutoffOf(rows, (row) => row.createdAt), candidates: rows.flatMap((row) => {
    const candidate = scoreServiceNote({ noteId: row.id, leadId: row.leadId, brokerId: row.userId, content: row.content, createdAt: row.createdAt }, rules["note.service"]);
    return candidate ? [candidate] : [];
  }) };
}

async function presenceCandidates(tenantId: string, window: Window, rules: ReturnType<typeof resolveRules>): Promise<SourceResult> {
  if (!rules["duty.presence"].enabled) return NONE;
  const presence = schema.dutyPresenceConfirmations;
  const rows = await getDatabase().select({ id: presence.id, brokerId: presence.brokerId, confirmedAt: presence.confirmedAt, confirmedBy: presence.confirmedBy })
    .from(presence)
    .where(and(eq(presence.tenantId, tenantId), eq(presence.status, "confirmed"), isNotNull(presence.confirmedAt), gte(presence.confirmedAt, window.since), lt(presence.confirmedAt, window.until)))
    .orderBy(asc(presence.confirmedAt))
    .limit(MAX_ROWS);
  return { cutoff: cutoffOf(rows, (row) => row.confirmedAt), candidates: rows.flatMap((row) => {
    const candidate = row.confirmedAt ? scorePresence({ confirmationId: row.id, brokerId: row.brokerId, confirmedAt: row.confirmedAt, confirmedBy: row.confirmedBy }, rules["duty.presence"]) : null;
    return candidate ? [candidate] : [];
  }) };
}

async function activeBrokerIds(tenantId: string) {
  const rows = await getDatabase().select({ userId: schema.tenantMemberships.userId }).from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.tenantId, tenantId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active")));
  return new Set(rows.map((row) => row.userId));
}

async function existingCapCounts(tenantId: string, candidates: PointsCandidate[], rules: ReturnType<typeof resolveRules>) {
  const capped = [...new Set(candidates.filter((candidate) => rules[candidate.ruleKey].dailyCap !== null).map((candidate) => candidate.ruleKey))];
  if (!capped.length) return new Map<string, number>();
  const days = [...new Set(candidates.map((candidate) => periodDay(candidate.occurredAt)))];
  const events = schema.engagementPointEvents;
  const rows = await getDatabase().select({ brokerId: events.brokerId, ruleKey: events.ruleKey, day: events.periodDay, total: count() })
    .from(events)
    .where(and(eq(events.tenantId, tenantId), inArray(events.ruleKey, capped), inArray(events.periodDay, days), isNull(events.reversedAt)))
    .groupBy(events.brokerId, events.ruleKey, events.periodDay);
  return new Map(rows.map((row) => [capKey(row.brokerId, row.ruleKey, String(row.day)), Number(row.total)]));
}

/** One tenant: read the facts of the window, score, cap and write the ledger. */
export async function collectTenantPoints(tenantId: string, now = new Date()) {
  const db = getDatabase();
  const [mark] = await db.select({ lastRunAt: schema.engagementWatermarks.lastRunAt }).from(schema.engagementWatermarks)
    .where(and(eq(schema.engagementWatermarks.tenantId, tenantId), eq(schema.engagementWatermarks.source, SOURCE))).limit(1);
  const window: Window = { since: mark ? new Date(mark.lastRunAt.getTime() - OVERLAP_MS) : new Date(now.getTime() - FIRST_RUN_LOOKBACK_MS), until: now };

  const [settings] = await db.select({ rules: schema.engagementSettings.rules }).from(schema.engagementSettings).where(eq(schema.engagementSettings.tenantId, tenantId)).limit(1);
  const rules = resolveRules(settings?.rules);
  const [tenant] = await db.select({ sla: schema.tenants.slaFirstContactMinutes }).from(schema.tenants).where(eq(schema.tenants.id, tenantId)).limit(1);
  const slaMinutes = Math.max(1, Number.parseInt(tenant?.sla ?? "15", 10) || 15);

  const [brokers, ...sources] = await Promise.all([
    activeBrokerIds(tenantId),
    firstContactCandidates(tenantId, window, slaMinutes, rules),
    fastAcceptCandidates(tenantId, window, rules),
    returnCandidates(tenantId, window, rules),
    noteCandidates(tenantId, window, rules),
    presenceCandidates(tenantId, window, rules),
  ]);
  const candidates = sources.flatMap((source) => source.candidates).filter((candidate) => brokers.has(candidate.brokerId));
  // A full page leaves rows behind: the mark stops at the earliest cutoff so nothing is skipped.
  const cutoffs = sources.map((source) => source.cutoff).filter((cutoff): cutoff is Date => Boolean(cutoff));
  const nextMark = cutoffs.length ? new Date(Math.min(...cutoffs.map((cutoff) => cutoff.getTime()))) : now;
  const kept = applyDailyCaps(candidates, rules, await existingCapCounts(tenantId, candidates, rules));

  let inserted = 0;
  if (kept.length) {
    const rows = await db.insert(schema.engagementPointEvents).values(kept.map((candidate) => ({
      id: randomUUID(),
      tenantId,
      brokerId: candidate.brokerId,
      ruleKey: candidate.ruleKey,
      points: candidate.points,
      entityType: candidate.entityType,
      entityId: candidate.entityId,
      leadId: candidate.leadId,
      idempotencyKey: candidate.idempotencyKey,
      occurredAt: candidate.occurredAt,
      periodDay: periodDay(candidate.occurredAt),
      metadata: candidate.metadata,
    }))).onConflictDoNothing().returning({ id: schema.engagementPointEvents.id });
    inserted = rows.length;
  }

  await db.insert(schema.engagementWatermarks).values({ tenantId, source: SOURCE, lastRunAt: nextMark, updatedAt: now })
    .onConflictDoUpdate({ target: [schema.engagementWatermarks.tenantId, schema.engagementWatermarks.source], set: { lastRunAt: nextMark, updatedAt: now } });

  const byRule = kept.reduce<Partial<Record<EngagementRuleKey, number>>>((acc, candidate) => ({ ...acc, [candidate.ruleKey]: (acc[candidate.ruleKey] ?? 0) + 1 }), {});
  return { tenantId, since: window.since.toISOString(), until: nextMark.toISOString(), partial: cutoffs.length > 0, candidates: candidates.length, inserted, byRule };
}

/** Cron entry: every tenant, one failure does not stop the others. Off unless BROKER_ENGAGEMENT is on. */
export async function runEngagementCollector(now = new Date()) {
  if ((await getFeatureFlag(FEATURE_FLAGS.BROKER_ENGAGEMENT).catch(() => "false")) !== "true") return { skipped: "flag_off" as const };
  const tenants = await getDatabase().select({ id: schema.tenants.id }).from(schema.tenants);
  const results = [];
  for (const tenant of tenants) {
    try {
      results.push(await collectTenantPoints(tenant.id, now));
    } catch (error) {
      console.error("[engagement] collector failed", tenant.id, error instanceof Error ? error.message : "unknown_error");
      results.push({ tenantId: tenant.id, error: true });
    }
  }
  return { tenants: results.length, results };
}

