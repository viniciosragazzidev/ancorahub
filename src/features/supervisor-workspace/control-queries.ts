import "server-only";

import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getLocalDutyParts } from "@/features/leads/assignment";
import { periodDay } from "@/features/engagement/scoring";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { classifyFirstContact, groupSupervisorPendencies, isOfferActionable, isReturnTaskOverdue, isShiftActiveNow, type SupervisorPendingItem, type SupervisorPendingReason } from "./control-core";

const ACTIVE_SERVICE = ["in_contact", "contacted", "quote_sent", "negotiation", "documentation_pending", "under_analysis", "awaiting_reply"] as const;
const WAITING_STATUS = ["new", "distributed"] as const;
const ACTIVE_OFFERS = ["PENDING", "SENT", "DELIVERED", "READ"] as const;
const MAX_ITEMS_PER_REASON = 50;
const OFFER_ACTIONABLE_AFTER_MS = 5 * 60_000;

type ControlBroker = {
  id: string;
  name: string;
  availability: string;
  onDuty: boolean;
  dutyName: string | null;
  presence: string | null;
  inService: number;
  acceptsToday: number;
  firstContactsToday: number;
};

export type SupervisorControlGroup = {
  reason: SupervisorPendingReason;
  count: number;
  items: SupervisorPendingItem[];
  remaining: number;
};

export type SupervisorControlData = {
  brokers: ControlBroker[];
  pendencies: SupervisorControlGroup[];
  updatedAt: string;
};

function dayStart(now: Date) {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  return new Date(`${key}T00:00:00-03:00`);
}

function recordCounts(rows: Array<{ brokerId: string; total: number | string }>) {
  return new Map(rows.map((row) => [row.brokerId, Number(row.total ?? 0)]));
}

function parseMessageRows(result: unknown): Array<{ lead_id: string; sent_at: Date | string }> {
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] } | null)?.rows ?? [];
  return rows as Array<{ lead_id: string; sent_at: Date | string }>;
}

/** Dados mínimos do painel de controle; todos os joins e filtros partem da sessão do supervisor. */
export async function getSupervisorControlData(context: TenantContext, now = new Date()): Promise<SupervisorControlData | null> {
  if (context.role !== "supervisor" || !context.supervisorTeamScope || !context.branchId || (await getLiteAudience(context)) !== "supervisor") return null;

  const db = getDatabase();
  const memberships = schema.tenantMemberships;
  const leads = schema.leads;
  const tenantRows = await db.select({ sla: schema.tenants.slaFirstContactMinutes }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1);
  const slaMinutes = Math.max(1, Number.parseInt(tenantRows[0]?.sla ?? "15", 10) || 15);
  const todayStart = dayStart(now);
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
  const lateBefore = new Date(now.getTime() - slaMinutes * 60_000);
  const actionableOfferBefore = new Date(now.getTime() - OFFER_ACTIONABLE_AFTER_MS);
  const localDuty = getLocalDutyParts(now);

  const teamRows = await db.select({ id: memberships.userId, name: schema.user.name, availability: memberships.availabilityStatus })
    .from(memberships)
    .innerJoin(schema.user, eq(schema.user.id, memberships.userId))
    .where(and(
      eq(memberships.tenantId, context.tenantId),
      eq(memberships.branchId, context.branchId),
      eq(memberships.supervisorId, context.userId),
      eq(memberships.role, "broker"),
      eq(memberships.status, "active"),
      eq(schema.user.status, "active"),
      eq(schema.user.active, true),
    ))
    .orderBy(asc(schema.user.name));
  const teamIds = teamRows.map((row) => row.id);
  if (!teamIds.length) return { brokers: [], pendencies: [], updatedAt: now.toISOString() };

  const inServiceSql = sql`count(*) filter (where ${inArray(leads.status, [...ACTIVE_SERVICE])})::int`;
  const contactsSql = sql`count(*) filter (where ${leads.firstContactAt} >= ${todayStart.toISOString()}::timestamptz and ${leads.firstContactAt} < ${tomorrowStart.toISOString()}::timestamptz)::int`;
  const importedHours = sql`case when ${leads.sourceMetadata}->>'firstContactHours' in ('4', '12', '24', '48', '72') then (${leads.sourceMetadata}->>'firstContactHours')::int else 24 end`;
  const importedPendingSql = sql`(
    ${leads.sourceChannel} = 'supervisor_import'
    and ${leads.status} = 'in_contact'
    and ${leads.firstContactAt} is null
    and ${leads.assignedAt} is not null
    and ${leads.assignedAt} + (${importedHours} * interval '1 hour') <= ${now.toISOString()}::timestamptz
    and not exists (
      select 1 from whatsapp_messages wm
      where wm.tenant_id = ${leads.tenantId} and wm.lead_id = ${leads.id}
        and coalesce(wm.provider_status, '') not in ('failed', 'deleted')
        and coalesce(wm.message_id, '') not ilike '%status@broadcast%'
        and not (wm.media_kind is null and lower(trim(coalesce(wm.body, ''))) in ('', '[text]'))
    )
  )`;
  const hotPendingSql = sql`(
    ${leads.sourceChannel} is distinct from 'supervisor_import'
    and ${inArray(leads.status, [...WAITING_STATUS])}
    and ${leads.firstContactAt} is null
    and ${leads.assignedAt} is not null
    and ${leads.assignedAt} < ${lateBefore.toISOString()}::timestamptz
    and not exists (
      select 1 from whatsapp_messages wm
      where wm.tenant_id = ${leads.tenantId} and wm.lead_id = ${leads.id}
        and coalesce(wm.provider_status, '') not in ('failed', 'deleted')
        and coalesce(wm.message_id, '') not ilike '%status@broadcast%'
        and not (wm.media_kind is null and lower(trim(coalesce(wm.body, ''))) in ('', '[text]'))
    )
  )`;
  const firstContactPendingSql = sql`(${importedPendingSql} or ${hotPendingSql})`;
  const baseLeadScope = and(
    eq(leads.tenantId, context.tenantId),
    eq(leads.branchId, context.branchId),
    inArray(leads.corretorId, teamIds),
    isNull(leads.deletedAt),
    isNull(leads.archivedAt),
  );

  const [metricsRows, acceptedRows, dutyRows, offerCounts, offerRows, firstContactCounts, firstContactRows, returnCounts, returnRows] = await Promise.all([
    db.select({ brokerId: leads.corretorId, inService: inServiceSql, firstContactsToday: contactsSql })
      .from(leads).where(baseLeadScope).groupBy(leads.corretorId),
    db.select({ brokerId: schema.leadOffers.brokerId, total: sql<number>`count(distinct ${leads.id})::int` }).from(schema.leadOffers)
      .innerJoin(leads, and(eq(leads.id, schema.leadOffers.leadId), eq(leads.tenantId, schema.leadOffers.tenantId)))
      .where(and(
        eq(schema.leadOffers.tenantId, context.tenantId),
        inArray(schema.leadOffers.brokerId, teamIds),
        eq(schema.leadOffers.status, "ACCEPTED"),
        gte(schema.leadOffers.acceptedAt, todayStart),
        lt(schema.leadOffers.acceptedAt, tomorrowStart),
        eq(leads.branchId, context.branchId),
        eq(leads.corretorId, schema.leadOffers.brokerId),
        isNull(leads.deletedAt),
        isNull(leads.archivedAt),
      )).groupBy(schema.leadOffers.brokerId),
    db.select({ assignmentId: schema.dutyRosterAssignments.id, brokerId: schema.dutyRosterAssignments.brokerId, name: schema.unitDutySchedules.name, startsAt: schema.dutyRosterAssignments.startsAt, endsAt: schema.dutyRosterAssignments.endsAt, pausedAt: schema.dutyRosterAssignments.pausedAt })
      .from(schema.dutyRosterAssignments)
      .innerJoin(schema.unitDutySchedules, and(eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId), eq(schema.unitDutySchedules.tenantId, schema.dutyRosterAssignments.tenantId)))
      .where(and(
        eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
        eq(schema.dutyRosterAssignments.branchId, context.branchId),
        inArray(schema.dutyRosterAssignments.brokerId, teamIds),
        eq(schema.dutyRosterAssignments.status, "active"),
        eq(schema.unitDutySchedules.status, "active"),
        or(
          eq(schema.dutyRosterAssignments.dutyDate, periodDay(now)),
          and(isNull(schema.dutyRosterAssignments.dutyDate), eq(schema.dutyRosterAssignments.dayOfWeek, localDuty.weekday), lte(schema.dutyRosterAssignments.validFrom, now), or(isNull(schema.dutyRosterAssignments.validUntil), gt(schema.dutyRosterAssignments.validUntil, now))),
        ),
      )).orderBy(asc(schema.dutyRosterAssignments.startsAt), asc(schema.dutyRosterAssignments.brokerId)),
    db.select({ brokerId: schema.leadOffers.brokerId, total: count() }).from(schema.leadOffers)
      .innerJoin(leads, and(eq(leads.id, schema.leadOffers.leadId), eq(leads.tenantId, schema.leadOffers.tenantId)))
      .where(and(
        eq(schema.leadOffers.tenantId, context.tenantId),
        inArray(schema.leadOffers.brokerId, teamIds),
        inArray(schema.leadOffers.status, [...ACTIVE_OFFERS]),
        gt(schema.leadOffers.expiresAt, now),
        lt(schema.leadOffers.offeredAt, actionableOfferBefore),
        eq(leads.corretorId, schema.leadOffers.brokerId),
        eq(leads.branchId, context.branchId),
        inArray(leads.status, [...WAITING_STATUS]),
        isNull(leads.deletedAt),
        isNull(leads.archivedAt),
      )).groupBy(schema.leadOffers.brokerId),
    db.select({ id: schema.leadOffers.id, leadId: leads.id, leadName: leads.nome, brokerId: schema.leadOffers.brokerId, brokerName: schema.user.name, offeredAt: schema.leadOffers.offeredAt, expiresAt: schema.leadOffers.expiresAt, status: schema.leadOffers.status, leadStatus: leads.status, currentOwnerId: leads.corretorId })
      .from(schema.leadOffers)
      .innerJoin(leads, and(eq(leads.id, schema.leadOffers.leadId), eq(leads.tenantId, schema.leadOffers.tenantId)))
      .innerJoin(schema.user, eq(schema.user.id, schema.leadOffers.brokerId))
      .where(and(
        eq(schema.leadOffers.tenantId, context.tenantId),
        inArray(schema.leadOffers.brokerId, teamIds),
        inArray(schema.leadOffers.status, [...ACTIVE_OFFERS]),
        gt(schema.leadOffers.expiresAt, now),
        lt(schema.leadOffers.offeredAt, actionableOfferBefore),
        eq(leads.corretorId, schema.leadOffers.brokerId),
        eq(leads.branchId, context.branchId),
        inArray(leads.status, [...WAITING_STATUS]),
        isNull(leads.deletedAt),
        isNull(leads.archivedAt),
      )).orderBy(asc(schema.leadOffers.offeredAt)).limit(MAX_ITEMS_PER_REASON),
    db.select({ brokerId: sql<string>`${leads.corretorId}`, total: sql<number>`count(*) filter (where ${firstContactPendingSql})::int` })
      .from(leads).where(baseLeadScope).groupBy(leads.corretorId),
    db.select({ leadId: leads.id, name: leads.nome, brokerId: sql<string>`${leads.corretorId}`, brokerName: schema.user.name, status: leads.status, sourceChannel: leads.sourceChannel, sourceMetadata: leads.sourceMetadata, assignedAt: leads.assignedAt, firstContactAt: leads.firstContactAt, stageEnteredAt: leads.stageEnteredAt })
      .from(leads)
      .innerJoin(schema.user, eq(schema.user.id, leads.corretorId))
      .where(and(baseLeadScope, firstContactPendingSql))
      .orderBy(asc(leads.assignedAt)).limit(MAX_ITEMS_PER_REASON),
    db.select({ brokerId: sql<string>`${schema.leadTasks.assignedTo}`, total: count() }).from(schema.leadTasks)
      .innerJoin(leads, and(eq(leads.id, schema.leadTasks.leadId), eq(leads.tenantId, schema.leadTasks.tenantId)))
      .where(and(
        eq(schema.leadTasks.tenantId, context.tenantId),
        inArray(schema.leadTasks.assignedTo, teamIds),
        isNull(schema.leadTasks.completedAt),
        isNotNull(schema.leadTasks.dueAt),
        lt(schema.leadTasks.dueAt, now),
        sql`(${schema.leadTasks.title} ilike '%retorn%' or ${schema.leadTasks.title} ilike '%follow%')`,
        eq(leads.branchId, context.branchId),
        eq(leads.corretorId, schema.leadTasks.assignedTo),
        isNull(leads.deletedAt),
        isNull(leads.archivedAt),
      )).groupBy(schema.leadTasks.assignedTo),
    db.select({ id: schema.leadTasks.id, leadId: leads.id, leadName: leads.nome, brokerId: sql<string>`${schema.leadTasks.assignedTo}`, brokerName: schema.user.name, dueAt: schema.leadTasks.dueAt, completedAt: schema.leadTasks.completedAt, title: schema.leadTasks.title })
      .from(schema.leadTasks)
      .innerJoin(leads, and(eq(leads.id, schema.leadTasks.leadId), eq(leads.tenantId, schema.leadTasks.tenantId)))
      .innerJoin(schema.user, eq(schema.user.id, schema.leadTasks.assignedTo))
      .where(and(
        eq(schema.leadTasks.tenantId, context.tenantId),
        inArray(schema.leadTasks.assignedTo, teamIds),
        isNull(schema.leadTasks.completedAt),
        isNotNull(schema.leadTasks.dueAt),
        lt(schema.leadTasks.dueAt, now),
        sql`(${schema.leadTasks.title} ilike '%retorn%' or ${schema.leadTasks.title} ilike '%follow%')`,
        eq(leads.branchId, context.branchId),
        eq(leads.corretorId, schema.leadTasks.assignedTo),
        isNull(leads.deletedAt),
        isNull(leads.archivedAt),
      )).orderBy(asc(schema.leadTasks.dueAt)).limit(MAX_ITEMS_PER_REASON),
  ]);

  const nowTime = localDuty.time;
  const activeDutyRows = dutyRows.map((row) => ({ ...row, active: isShiftActiveNow(row.startsAt, row.endsAt, nowTime, Boolean(row.pausedAt)) }));
  const presenceRows = activeDutyRows.length
    ? await db.select({ assignmentId: schema.dutyPresenceConfirmations.assignmentId, status: schema.dutyPresenceConfirmations.status })
      .from(schema.dutyPresenceConfirmations)
      .where(and(eq(schema.dutyPresenceConfirmations.tenantId, context.tenantId), inArray(schema.dutyPresenceConfirmations.brokerId, teamIds), eq(schema.dutyPresenceConfirmations.dutyDate, periodDay(now))))
      .orderBy(desc(schema.dutyPresenceConfirmations.createdAt))
    : [];
  const presenceById = new Map<string, string>();
  for (const row of presenceRows) if (!presenceById.has(row.assignmentId)) presenceById.set(row.assignmentId, row.status);
  const metricsByBroker = new Map(metricsRows.map((row) => [row.brokerId, row]));
  const acceptsByBroker = recordCounts(acceptedRows);
  const team = teamRows.map((broker) => {
    const metric = metricsByBroker.get(broker.id);
    const duty = activeDutyRows.find((row) => row.brokerId === broker.id && row.active);
    return {
      id: broker.id,
      name: broker.name,
      availability: broker.availability,
      onDuty: Boolean(duty),
      dutyName: duty?.name ?? null,
      presence: duty ? presenceById.get(duty.assignmentId) ?? null : null,
      inService: Number(metric?.inService ?? 0),
      acceptsToday: acceptsByBroker.get(broker.id) ?? 0,
      firstContactsToday: Number(metric?.firstContactsToday ?? 0),
    };
  });

  let latestMessages: Array<{ lead_id: string; sent_at: Date | string }> = [];
  if (firstContactRows.length) {
    const leadIds = firstContactRows.map((row) => row.leadId);
    const messageResult = await db.execute(sql`
      select distinct on (${schema.whatsappMessages.leadId}) ${schema.whatsappMessages.leadId} as lead_id, ${schema.whatsappMessages.sentAt} as sent_at
      from ${schema.whatsappMessages}
      where ${schema.whatsappMessages.tenantId} = ${context.tenantId}
        and ${inArray(schema.whatsappMessages.leadId, leadIds)}
        and coalesce(${schema.whatsappMessages.providerStatus}, '') not in ('failed', 'deleted')
        and coalesce(${schema.whatsappMessages.messageId}, '') not ilike '%status@broadcast%'
        and not (${schema.whatsappMessages.mediaKind} is null and lower(trim(coalesce(${schema.whatsappMessages.body}, ''))) in ('', '[text]'))
      order by ${schema.whatsappMessages.leadId}, ${schema.whatsappMessages.sentAt} desc
    `);
    latestMessages = parseMessageRows(messageResult);
  }
  const latestMessageByLead = new Map(latestMessages.map((row) => [row.lead_id, new Date(row.sent_at)]));
  const brokerNameById = new Map(teamRows.map((row) => [row.id, row.name]));
  const firstContactItems = firstContactRows.flatMap((row) => {
    const item = classifyFirstContact({
      leadId: row.leadId,
      name: row.name,
      brokerId: row.brokerId,
      brokerName: row.brokerName ?? brokerNameById.get(row.brokerId) ?? "Corretor",
      status: row.status,
      sourceChannel: row.sourceChannel,
      sourceMetadata: row.sourceMetadata,
      assignedAt: row.assignedAt,
      firstContactAt: row.firstContactAt,
      stageEnteredAt: row.stageEnteredAt,
      latestMessageAt: latestMessageByLead.get(row.leadId) ?? null,
      slaMinutes,
      now,
    });
    return item ? [item] : [];
  });
  const offerItems: SupervisorPendingItem[] = offerRows.flatMap((row) => {
    if (!isOfferActionable({ status: row.status, offeredAt: row.offeredAt, expiresAt: row.expiresAt, leadStatus: row.leadStatus, currentOwnerId: row.currentOwnerId, brokerId: row.brokerId, now })) return [];
    const minutes = Math.max(0, Math.floor((now.getTime() - row.offeredAt.getTime()) / 60_000));
    return [{ id: `offer:${row.id}`, reason: "offer_waiting" as const, leadId: row.leadId, leadName: row.leadName, brokerId: row.brokerId, brokerName: row.brokerName, dueAt: row.expiresAt.toISOString(), detail: `Oferta sem aceite há ${minutes} min · vence ${new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(row.expiresAt)}` }];
  });
  const returnItems: SupervisorPendingItem[] = returnRows.flatMap((row) => {
    if (!isReturnTaskOverdue({ title: row.title, dueAt: row.dueAt, completedAt: row.completedAt, now })) return [];
    const minutes = Math.max(0, Math.floor((now.getTime() - row.dueAt!.getTime()) / 60_000));
    return [{ id: `return:${row.id}`, reason: "return_overdue" as const, leadId: row.leadId, leadName: row.leadName, brokerId: row.brokerId, brokerName: row.brokerName, dueAt: row.dueAt!.toISOString(), detail: `${row.title} · retorno vencido há ${minutes} min` }];
  });
  const countsByReason = {
    offer_waiting: recordCounts(offerCounts),
    first_contact_overdue: recordCounts(firstContactCounts),
    return_overdue: recordCounts(returnCounts),
  };
  const rawGroups = groupSupervisorPendencies([...offerItems, ...firstContactItems, ...returnItems]);
  const pendencies = rawGroups.map((group) => {
    const total = [...countsByReason[group.reason].values()].reduce((sum, value) => sum + value, 0);
    return { ...group, count: total, remaining: Math.max(0, total - group.items.length) };
  });

  return { brokers: team, pendencies, updatedAt: now.toISOString() };
}
