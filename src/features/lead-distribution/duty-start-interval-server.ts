import "server-only";

import { and, eq, gt, inArray, isNull, lte, max, ne, or } from "drizzle-orm";

import { getLocalDutyParts } from "@/features/leads/assignment";

import { getFeatureFlag, FEATURE_FLAGS } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { filterPausedDutyAssignmentsBeforeResolution, resolveEffectiveDutyAssignments } from "./dated-duty-roster";
import { getPresenceEligibleAssignments } from "./duty-presence";
import { DUTY_START_INTERVAL_MINUTES, dutyStartIntervalReleaseAt, resolveDutyStartInterval } from "./duty-start-interval";

type DatabaseLike = Pick<ReturnType<typeof getDatabase>, "select">;

export type DutyStartPresenceCount = { startsAt: Date; confirmed: number; pending: number };
export type DutyStartIntervalHold = { retryAt: Date; scheduleId: string; endsAt: Date; confirmed: number; pending: number };
/** `activeBrokerIds`: corretores cujo plantão está no intervalo agora (com ou sem lead recente). */
export type DutyStartIntervalResolution = { holds: Map<string, DutyStartIntervalHold>; activeBrokerIds: Set<string> };

/** Intervalo de início de plantão (11/11): ligado pelo Super-admin; padrão desligado. */
export async function isDutyStartOfferIntervalEnabled() {
  return (await getFeatureFlag(FEATURE_FLAGS.DUTY_START_OFFER_INTERVAL).catch(() => "false")) === "true";
}

/**
 * Última oferta (exceto CANCELLED) de cada corretor nos últimos 8 minutos, em qualquer fila: no
 * começo do plantão o corretor recebe um lead a cada 8 min, venha de onde vier. A atribuição não
 * conta: aceitar a oferta grava `assignedAt` e empurraria o intervalo para depois do aceite.
 */
export async function loadDutyStartIntervalAnchors(db: DatabaseLike, input: { tenantId: string; brokerIds: readonly string[]; now: Date }) {
  const anchors = new Map<string, { lastOfferAt: Date | null; lastAssignedAt: Date | null }>();
  if (!input.brokerIds.length) return anchors;
  const since = new Date(input.now.getTime() - DUTY_START_INTERVAL_MINUTES * 60_000);
  const offers = await db.select({ brokerId: schema.leadOffers.brokerId, at: max(schema.leadOffers.offeredAt) }).from(schema.leadOffers).where(and(
    eq(schema.leadOffers.tenantId, input.tenantId),
    inArray(schema.leadOffers.brokerId, [...input.brokerIds]),
    gt(schema.leadOffers.offeredAt, since),
    lte(schema.leadOffers.offeredAt, input.now),
    ne(schema.leadOffers.status, "CANCELLED"),
  )).groupBy(schema.leadOffers.brokerId);
  for (const row of offers) if (row.brokerId && row.at) anchors.set(row.brokerId, { lastOfferAt: row.at, lastAssignedAt: null });
  return anchors;
}

/**
 * Corretores que estão no intervalo de início agora, com o momento em que voltam a poder receber.
 * Fail-open: com a flag desligada ou qualquer erro, devolve vazio e a distribuição fica como antes.
 */
export async function resolveDutyStartIntervalHolds(input: {
  tenantId: string;
  brokerIds: readonly string[];
  scheduleIdByBroker: ReadonlyMap<string, string>;
  startPresenceBySchedule: ReadonlyMap<string, DutyStartPresenceCount> | undefined;
  now?: Date;
  db?: DatabaseLike;
}): Promise<DutyStartIntervalResolution> {
  const holds = new Map<string, DutyStartIntervalHold>();
  const empty = { holds, activeBrokerIds: new Set<string>() };
  try {
    if (!input.startPresenceBySchedule?.size || !input.brokerIds.length) return empty;
    if (!(await isDutyStartOfferIntervalEnabled())) return empty;
    const now = input.now ?? new Date();
    const activeBySchedule = new Map<string, { endsAt: Date; confirmed: number; pending: number }>();
    for (const [scheduleId, count] of input.startPresenceBySchedule) {
      const state = resolveDutyStartInterval({ occurrenceStartsAt: count.startsAt, now, confirmedCount: count.confirmed, pendingCount: count.pending });
      if (state.active) activeBySchedule.set(scheduleId, { endsAt: state.endsAt, confirmed: state.confirmedCount, pending: state.pendingCount });
    }
    if (!activeBySchedule.size) return empty;
    const brokerIds = input.brokerIds.filter((brokerId) => activeBySchedule.has(input.scheduleIdByBroker.get(brokerId) ?? ""));
    const anchors = await loadDutyStartIntervalAnchors(input.db ?? getDatabase(), { tenantId: input.tenantId, brokerIds, now });
    for (const brokerId of brokerIds) {
      const scheduleId = input.scheduleIdByBroker.get(brokerId)!;
      const active = activeBySchedule.get(scheduleId)!;
      const anchor = anchors.get(brokerId);
      const retryAt = anchor ? dutyStartIntervalReleaseAt({ ...anchor, now, intervalEndsAt: active.endsAt }) : null;
      if (retryAt) holds.set(brokerId, { retryAt, scheduleId, ...active });
    }
    return { holds, activeBrokerIds: new Set(brokerIds) };
  } catch (error) {
    console.error("[plantao] start_interval_failed", { error: error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 300) : "UnknownError" });
    return { holds: new Map(), activeBrokerIds: new Set<string>() };
  }
}

/**
 * Para o aviso do corretor no Lite: os plantões (dentre `scheduleIds`) que estão no intervalo de
 * início agora. Mesma contagem da distribuição, sem o filtro por unidade. Fail-open (vazio).
 */
export async function listSchedulesInDutyStartInterval(input: { tenantId: string; scheduleIds: readonly string[]; now?: Date }): Promise<Set<string>> {
  const result = new Set<string>();
  try {
    if (!input.scheduleIds.length || !(await isDutyStartOfferIntervalEnabled())) return result;
    const now = input.now ?? new Date();
    const db = getDatabase();
    const local = getLocalDutyParts(now);
    const [schedules, rows] = await Promise.all([
      db.select({
        id: schema.unitDutySchedules.id, dayOfWeek: schema.unitDutySchedules.dayOfWeek, startsAt: schema.unitDutySchedules.startsAt,
        endsAt: schema.unitDutySchedules.endsAt, timezone: schema.unitDutySchedules.timezone, attendanceMode: schema.unitDutySchedules.attendanceMode,
        validFrom: schema.unitDutySchedules.validFrom, validUntil: schema.unitDutySchedules.validUntil,
      }).from(schema.unitDutySchedules).where(and(eq(schema.unitDutySchedules.tenantId, input.tenantId), inArray(schema.unitDutySchedules.id, [...input.scheduleIds]))),
      db.select({
        id: schema.dutyRosterAssignments.id, brokerId: schema.dutyRosterAssignments.brokerId, scheduleId: schema.dutyRosterAssignments.scheduleId,
        dayOfWeek: schema.dutyRosterAssignments.dayOfWeek, startsAt: schema.dutyRosterAssignments.startsAt, endsAt: schema.dutyRosterAssignments.endsAt,
        pausedAt: schema.dutyRosterAssignments.pausedAt, validFrom: schema.dutyRosterAssignments.validFrom, validUntil: schema.dutyRosterAssignments.validUntil,
        branchId: schema.dutyRosterAssignments.branchId, dutyDate: schema.dutyRosterAssignments.dutyDate, attendanceMode: schema.dutyRosterAssignments.attendanceMode,
      }).from(schema.dutyRosterAssignments).where(and(
        eq(schema.dutyRosterAssignments.tenantId, input.tenantId),
        inArray(schema.dutyRosterAssignments.scheduleId, [...input.scheduleIds]),
        eq(schema.dutyRosterAssignments.dayOfWeek, local.weekday),
        eq(schema.dutyRosterAssignments.status, "active"),
        lte(schema.dutyRosterAssignments.startsAt, local.time),
        gt(schema.dutyRosterAssignments.endsAt, local.time),
        lte(schema.dutyRosterAssignments.validFrom, now),
        isNull(schema.dutyRosterAssignments.pausedAt),
        or(isNull(schema.dutyRosterAssignments.validUntil), gt(schema.dutyRosterAssignments.validUntil, now)),
      )),
    ]);
    const effective = await resolveEffectiveDutyAssignments(input.tenantId, filterPausedDutyAssignmentsBeforeResolution(rows), now);
    const presence = await getPresenceEligibleAssignments({ tenantId: input.tenantId, assignments: effective, schedules, now });
    for (const scheduleId of input.scheduleIds) {
      const mine = effective.filter((row) => row.scheduleId === scheduleId && presence.occurrenceStartsAtByAssignment.has(row.id));
      if (!mine.length) continue;
      const startsAt = mine.reduce((earliest, row) => {
        const at = presence.occurrenceStartsAtByAssignment.get(row.id)!;
        return at < earliest ? at : earliest;
      }, presence.occurrenceStartsAtByAssignment.get(mine[0].id)!);
      const state = resolveDutyStartInterval({
        occurrenceStartsAt: startsAt,
        now,
        confirmedCount: mine.filter((row) => presence.eligibleAssignmentIds.has(row.id)).length,
        pendingCount: mine.filter((row) => presence.pendingAssignmentIds.has(row.id)).length,
      });
      if (state.active) result.add(scheduleId);
    }
    return result;
  } catch (error) {
    console.error("[plantao] start_interval_notice_failed", { error: error instanceof Error ? error.name : "UnknownError" });
    return new Set();
  }
}
