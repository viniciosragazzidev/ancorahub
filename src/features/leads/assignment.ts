import "server-only";

import { and, asc, count, eq, gt, inArray, isNull, lte, not, or } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { getFeatureFlag, FEATURE_FLAGS } from "@/features/system-settings/queries";

const activeStatuses = ["distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;

function getLocalDutyParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const weekday = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.find((part) => part.type === "weekday")?.value as "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat"] ?? 0;
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return { weekday, time: `${hour === "24" ? "00" : hour}:${minute}` };
}

/**
 * Escolhe o corretor elegível com a menor carteira ativa (desempate por criação).
 * Retorna null se a filial não permitir distribuição automática ou for a Central de redistribuição.
 * Se webhookCredentialId for informado, filtra por plantões com aquela origem.
 */
export async function chooseAvailableBroker(tenantId: string, branchId: string | null, excludeBrokerId?: string | null, webhookCredentialId?: string | null) {
  if (!branchId) return null;
  const db = getDatabase();

  const [branch, brokers, availabilityOnboardingEnabled] = await Promise.all([
    db
      .select({ autoDistribute: schema.branches.autoDistribute, isDistributionHub: schema.branches.isDistributionHub })
      .from(schema.branches)
      .where(and(eq(schema.branches.id, branchId), eq(schema.branches.tenantId, tenantId)))
      .limit(1),
    db
      .select({ id: schema.user.id, createdAt: schema.user.createdAt })
      .from(schema.user)
      .innerJoin(schema.tenantMemberships, eq(schema.tenantMemberships.userId, schema.user.id))
      .where(and(
        eq(schema.tenantMemberships.tenantId, tenantId),
        eq(schema.tenantMemberships.branchId, branchId),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
        eq(schema.tenantMemberships.availabilityStatus, "available"),
        eq(schema.user.active, true),
        eq(schema.user.status, "active"),
        ...(excludeBrokerId ? [not(eq(schema.user.id, excludeBrokerId))] : []),
      ))
      .orderBy(asc(schema.user.createdAt)),
    getFeatureFlag(FEATURE_FLAGS.BROKER_AVAILABILITY_ONBOARDING),
  ]);

  if (!branch[0] || !branch[0].autoDistribute || branch[0].isDistributionHub) return null;
  if (!brokers.length) return null;

  // ── Fetch max active leads limit for priority logic ────────────────
  const [tenantSettings] = await db
    .select({ maxActiveLeadsLimit: schema.tenants.maxActiveLeadsLimit })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1);
  const limit = tenantSettings?.maxActiveLeadsLimit ?? 10;

  // ── Plantão credential filter ──────────────────────────────────────
  const local = getLocalDutyParts(new Date());
  const scheduledBrokerIds = availabilityOnboardingEnabled !== "false"
    ? new Set(
        (
          await db
            .select({ brokerId: schema.brokerAvailabilityWindows.brokerId })
            .from(schema.brokerAvailabilityWindows)
            .where(
              and(
                eq(schema.brokerAvailabilityWindows.tenantId, tenantId),
                eq(schema.brokerAvailabilityWindows.dayOfWeek, local.weekday),
                lte(schema.brokerAvailabilityWindows.startsAt, local.time),
                gt(schema.brokerAvailabilityWindows.endsAt, local.time)
              )
            )
        ).map((window) => window.brokerId)
      )
    : null;
  const eligibleBySchedule = scheduledBrokerIds ? brokers.filter((broker) => scheduledBrokerIds.has(broker.id)) : brokers;
  if (!eligibleBySchedule.length) return null;
  const activeSchedules = await db.select({ id: schema.unitDutySchedules.id, webhookCredentialId: schema.unitDutySchedules.webhookCredentialId })
    .from(schema.unitDutySchedules)
    .where(and(
      eq(schema.unitDutySchedules.tenantId, tenantId),
      eq(schema.unitDutySchedules.branchId, branchId),
      eq(schema.unitDutySchedules.dayOfWeek, local.weekday),
      eq(schema.unitDutySchedules.status, "active"),
      lte(schema.unitDutySchedules.startsAt, local.time),
      gt(schema.unitDutySchedules.endsAt, local.time),
    ));

  if (activeSchedules.length) {
    const matchingScheduleIds = webhookCredentialId
      ? activeSchedules.filter((s) => s.webhookCredentialId === webhookCredentialId).map((s) => s.id)
      : activeSchedules.filter((s) => s.webhookCredentialId === null).map((s) => s.id);

    if (!matchingScheduleIds.length) return null;

    const rosterAssignments = await db.select({ brokerId: schema.dutyRosterAssignments.brokerId })
      .from(schema.dutyRosterAssignments)
      .where(and(
        eq(schema.dutyRosterAssignments.tenantId, tenantId),
        eq(schema.dutyRosterAssignments.branchId, branchId),
        eq(schema.dutyRosterAssignments.dayOfWeek, local.weekday),
        eq(schema.dutyRosterAssignments.status, "active"),
        lte(schema.dutyRosterAssignments.startsAt, local.time),
        gt(schema.dutyRosterAssignments.endsAt, local.time),
        inArray(schema.dutyRosterAssignments.scheduleId, matchingScheduleIds),
      ));

    const rosterIds = new Set(rosterAssignments.map((a) => a.brokerId));
    const filtered = eligibleBySchedule.filter((b) => rosterIds.has(b.id));
    if (!filtered.length) return null;
    const ids = filtered.map((b) => b.id);
    const workloads = await db.select({ brokerId: schema.leads.corretorId, total: count(schema.leads.id) }).from(schema.leads).where(and(eq(schema.leads.tenantId, tenantId), inArray(schema.leads.corretorId, ids), inArray(schema.leads.status, activeStatuses))).groupBy(schema.leads.corretorId);
    const loadByBroker = new Map(workloads.map((item) => [item.brokerId, Number(item.total)]));

    // Limit Priority Grouping
    const brokersBelowLimit = filtered.filter(b => (loadByBroker.get(b.id) ?? 0) < limit);
    const targetBrokers = brokersBelowLimit.length > 0 ? brokersBelowLimit : filtered;

    return [...targetBrokers].sort((a, b) => (loadByBroker.get(a.id) ?? 0) - (loadByBroker.get(b.id) ?? 0))[0]?.id ?? null;
  }

  // ── Fallback: all available brokers (no plantão filter) ────────────
  const ids = eligibleBySchedule.map((broker) => broker.id);
  const workloads = await db
    .select({ brokerId: schema.leads.corretorId, total: count(schema.leads.id) })
    .from(schema.leads)
    .where(and(eq(schema.leads.tenantId, tenantId), inArray(schema.leads.corretorId, ids), inArray(schema.leads.status, activeStatuses)))
    .groupBy(schema.leads.corretorId);
  const loadByBroker = new Map(workloads.map((item) => [item.brokerId, Number(item.total)]));

  // Limit Priority Grouping
  const brokersBelowLimit = eligibleBySchedule.filter(b => (loadByBroker.get(b.id) ?? 0) < limit);
  const targetBrokers = brokersBelowLimit.length > 0 ? brokersBelowLimit : eligibleBySchedule;

  return [...targetBrokers].sort((a, b) => (loadByBroker.get(a.id) ?? 0) - (loadByBroker.get(b.id) ?? 0))[0]?.id ?? null;
}
