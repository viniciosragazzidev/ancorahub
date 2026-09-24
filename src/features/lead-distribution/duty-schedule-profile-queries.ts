import "server-only";

import { and, asc, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import { getFeatureFlag, FEATURE_FLAGS } from "@/features/system-settings/queries";
import { getRelevantDutyWindow } from "./duty-presence-domain";

const LEADS_WINDOW_DAYS = 7;
const LEADS_LIMIT = 200;

export type DutyScheduleProfile = Awaited<ReturnType<typeof getDutyScheduleProfile>>;

/**
 * Full picture of one plantão occurrence-family: the schedule itself, who is
 * scheduled on it right now, which queues route leads into it (legacy single
 * link, current plural link, or the schedule's own legacy queueId — a plantão
 * can be wired to a queue through any of the three), and the leads that
 * actually landed with one of its rostered brokers recently.
 */
export async function getDutyScheduleProfile(context: TenantContext, scheduleId: string) {
  const db = getDatabase();

  const [schedule] = await db
    .select({
      id: schema.unitDutySchedules.id,
      tenantId: schema.unitDutySchedules.tenantId,
      branchId: schema.unitDutySchedules.branchId,
      branchName: schema.branches.name,
      legacyQueueId: schema.unitDutySchedules.queueId,
      legacyQueueName: schema.leadQueues.name,
      name: schema.unitDutySchedules.name,
      dayOfWeek: schema.unitDutySchedules.dayOfWeek,
      startsAt: schema.unitDutySchedules.startsAt,
      endsAt: schema.unitDutySchedules.endsAt,
      priority: schema.unitDutySchedules.priority,
      minimumBrokers: schema.unitDutySchedules.minimumBrokers,
      status: schema.unitDutySchedules.status,
      timezone: schema.unitDutySchedules.timezone,
      validFrom: schema.unitDutySchedules.validFrom,
      validUntil: schema.unitDutySchedules.validUntil,
    })
    .from(schema.unitDutySchedules)
    .leftJoin(schema.branches, eq(schema.unitDutySchedules.branchId, schema.branches.id))
    .leftJoin(schema.leadQueues, eq(schema.unitDutySchedules.queueId, schema.leadQueues.id))
    .where(and(eq(schema.unitDutySchedules.id, scheduleId), eq(schema.unitDutySchedules.tenantId, context.tenantId)))
    .limit(1);
  if (!schedule) throw new Error("Plantão não encontrado.");
  if (context.role === "manager" && context.branchId && schedule.branchId && schedule.branchId !== context.branchId) {
    throw new AuthorizationError("Este plantão está fora da sua unidade.");
  }

  const roster = await db
    .select({
      id: schema.dutyRosterAssignments.id,
      brokerId: schema.dutyRosterAssignments.brokerId,
      brokerName: schema.user.name,
      internalCode: schema.brokerProfiles.internalCode,
      phone: schema.brokerProfiles.phone,
      userActive: schema.user.active,
      membershipStatus: schema.tenantMemberships.status,
      availabilityStatus: schema.tenantMemberships.availabilityStatus,
      status: schema.dutyRosterAssignments.status,
      dayOfWeek: schema.dutyRosterAssignments.dayOfWeek,
      startsAt: schema.dutyRosterAssignments.startsAt,
      endsAt: schema.dutyRosterAssignments.endsAt,
      validFrom: schema.dutyRosterAssignments.validFrom,
      validUntil: schema.dutyRosterAssignments.validUntil,
    })
    .from(schema.dutyRosterAssignments)
    .innerJoin(schema.user, eq(schema.dutyRosterAssignments.brokerId, schema.user.id))
    .leftJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.userId, schema.user.id), eq(schema.brokerProfiles.tenantId, context.tenantId)))
    .leftJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.user.id), eq(schema.tenantMemberships.tenantId, context.tenantId)))
    .where(and(eq(schema.dutyRosterAssignments.scheduleId, scheduleId), eq(schema.dutyRosterAssignments.status, "active")))
    .orderBy(asc(schema.user.name));

  const linkedQueues = await db
    .select({ id: schema.leadQueues.id, name: schema.leadQueues.name, branchName: schema.branches.name })
    .from(schema.leadQueues)
    .leftJoin(schema.branches, eq(schema.leadQueues.branchId, schema.branches.id))
    .where(and(
      eq(schema.leadQueues.tenantId, context.tenantId),
      isNull(schema.leadQueues.deletedAt),
      or(
        eq(schema.leadQueues.exclusiveDutyScheduleId, scheduleId),
        sql`${schema.leadQueues.exclusiveDutyScheduleIds} @> ${JSON.stringify([scheduleId])}::jsonb`,
        schedule.legacyQueueId ? eq(schema.leadQueues.id, schedule.legacyQueueId) : sql`false`,
      ),
    ));

  const queueIds = linkedQueues.map((queue) => queue.id);
  const since = new Date(Date.now() - LEADS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Every lead routed through this plantão's queues — waiting, offered,
  // distributed or in service — not only the ones already with a rostered broker.
  const leads = queueIds.length
    ? await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        status: schema.leads.status,
        distributionStatus: schema.leads.distributionStatus,
        corretorId: schema.leads.corretorId,
        brokerName: schema.user.name,
        queueId: schema.leads.queueId,
        queueName: schema.leadQueues.name,
        assignedAt: schema.leads.assignedAt,
        createdAt: schema.leads.createdAt,
      })
      .from(schema.leads)
      .leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id))
      .leftJoin(schema.leadQueues, eq(schema.leads.queueId, schema.leadQueues.id))
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        inArray(schema.leads.queueId, queueIds),
        or(gte(schema.leads.createdAt, since), gte(schema.leads.assignedAt, since)),
        isNull(schema.leads.deletedAt),
        isNull(schema.leads.archivedAt),
      ))
      .orderBy(desc(schema.leads.createdAt))
      .limit(LEADS_LIMIT)
    : [];

  const leadsPerBroker = new Map<string, number>();
  for (const lead of leads) {
    if (!lead.corretorId) continue;
    leadsPerBroker.set(lead.corretorId, (leadsPerBroker.get(lead.corretorId) ?? 0) + 1);
  }

  const presenceEnabled = (await getFeatureFlag(FEATURE_FLAGS.DUTY_PRESENCE_CONFIRMATION)) === "true";
  const now = new Date();
  const occurrenceByAssignment = new Map(roster.flatMap((entry) => {
    const occurrence = getRelevantDutyWindow({
      dayOfWeek: entry.dayOfWeek,
      startsAt: entry.startsAt,
      endsAt: entry.endsAt,
      timezone: schedule.timezone,
    }, now, 24 * 60);
    return occurrence && occurrence.startsAt >= entry.validFrom && (!entry.validUntil || occurrence.startsAt < entry.validUntil)
      ? [[entry.id, occurrence] as const]
      : [];
  }));
  const dutyDates = [...new Set([...occurrenceByAssignment.values()].map((occurrence) => occurrence.dutyDate))];
  const presenceRows = presenceEnabled && dutyDates.length
    ? await db.select({
      assignmentId: schema.dutyPresenceConfirmations.assignmentId,
      dutyDate: schema.dutyPresenceConfirmations.dutyDate,
      status: schema.dutyPresenceConfirmations.status,
      confirmedAt: schema.dutyPresenceConfirmations.confirmedAt,
      notificationStatus: schema.dutyPresenceConfirmations.notificationStatus,
      notificationErrorCode: schema.dutyPresenceConfirmations.notificationErrorCode,
    }).from(schema.dutyPresenceConfirmations).where(and(
      eq(schema.dutyPresenceConfirmations.tenantId, context.tenantId),
      eq(schema.dutyPresenceConfirmations.scheduleId, scheduleId),
      inArray(schema.dutyPresenceConfirmations.assignmentId, [...occurrenceByAssignment.keys()]),
      inArray(schema.dutyPresenceConfirmations.dutyDate, dutyDates),
    ))
    : [];
  const presenceByAssignment = new Map(presenceRows.map((row) => [`${row.assignmentId}:${row.dutyDate}`, row]));

  return {
    schedule: {
      ...schedule,
      queueName: schedule.legacyQueueName ?? (linkedQueues.length ? linkedQueues.map((queue) => queue.name).join(", ") : "Nenhuma fila vinculada"),
    },
    presenceEnabled,
    roster: roster.map(({ phone, userActive, membershipStatus, dayOfWeek, startsAt, endsAt, validFrom, validUntil, ...entry }) => {
      const occurrence = occurrenceByAssignment.get(entry.id);
      const presence = occurrence ? presenceByAssignment.get(`${entry.id}:${occurrence.dutyDate}`) : null;
      return {
      ...entry,
      leadsInWindow: leadsPerBroker.get(entry.brokerId) ?? 0,
      // Same prerequisites the distribution engine applies before offering a lead.
      blockedReason: !userActive || membershipStatus !== "active" ? "Conta inativa" : !phone ? "Sem telefone cadastrado (não recebe ofertas)" : presenceEnabled && occurrence && presence?.status !== "confirmed" ? "Aguardando confirmação do plantão" : null,
      presenceStatus: !presenceEnabled || !occurrence ? "not_requested" as const : presence?.status === "confirmed" ? "confirmed" as const : "pending" as const,
      confirmedAt: presence?.confirmedAt ?? null,
      notificationStatus: presence?.notificationStatus ?? null,
      notificationErrorCode: presence?.notificationErrorCode ?? null,
      dutyDate: occurrence?.dutyDate ?? null,
      };
    }),
    linkedQueues,
    leads,
    windowDays: LEADS_WINDOW_DAYS,
  };
}
