import "server-only";

import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getLocalDutyParts } from "@/features/leads/assignment";
import { periodDay } from "@/features/engagement/scoring";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { BROKER_WORKSPACE_ACTIVE_LEAD_STATUSES } from "@/features/broker-workspace/priority";

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

type FirstContactCandidate = {
  leadId: string;
  name: string;
  status: string;
  sourceChannel: string | null;
  sourceMetadata: unknown;
  assignedAt: Date | string | null;
  firstContactAt: Date | string | null;
  stageEnteredAt: Date | string | null;
  hasAnyMessage: boolean;
  brokerId: string;
};

function parseCandidateAggregate(value: unknown): Omit<FirstContactCandidate, "brokerId">[] {
  if (Array.isArray(value)) return value as Omit<FirstContactCandidate, "brokerId">[];
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed as Omit<FirstContactCandidate, "brokerId">[] : [];
    } catch {
      return [];
    }
  }
  return [];
}

function nullableDate(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
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
  const candidateWindowSql = sql`(
    ${leads.firstContactAt} is null
    and ${leads.assignedAt} is not null
    and ${inArray(leads.status, [...BROKER_WORKSPACE_ACTIVE_LEAD_STATUSES])}
    and (
      (${leads.sourceChannel} = 'supervisor_import' and ${leads.assignedAt} <= ${now.toISOString()}::timestamptz - interval '4 hours')
      or (${leads.sourceChannel} is distinct from 'supervisor_import' and ${leads.assignedAt} <= ${lateBefore.toISOString()}::timestamptz)
    )
  )`;
  const hasAnyMessageSql = sql`exists (
    select 1 from whatsapp_messages wm
    where wm.tenant_id = ${leads.tenantId} and wm.lead_id = ${leads.id}
      and coalesce(wm.message_id, '') not ilike '%status@broadcast%'
      and not (wm.media_kind is null and lower(trim(coalesce(wm.body, ''))) in ('', '[text]'))
  )`;
  const firstContactCandidatesSql = sql`coalesce(
    jsonb_agg(jsonb_build_object(
      'leadId', ${leads.id},
      'name', ${leads.nome},
      'status', ${leads.status},
      'sourceChannel', ${leads.sourceChannel},
      'sourceMetadata', jsonb_build_object('firstContactHours', ${leads.sourceMetadata}->>'firstContactHours'),
      'assignedAt', ${leads.assignedAt},
      'firstContactAt', ${leads.firstContactAt},
      'stageEnteredAt', ${leads.stageEnteredAt},
      'hasAnyMessage', ${hasAnyMessageSql}
    )) filter (where ${candidateWindowSql}),
    '[]'::jsonb
  )`;
  const baseLeadScope = and(
    eq(leads.tenantId, context.tenantId),
    eq(leads.branchId, context.branchId),
    inArray(leads.corretorId, teamIds),
    isNull(leads.deletedAt),
    isNull(leads.archivedAt),
  );

  const [metricsRows, acceptedRows, dutyRows, offerRows, returnRows] = await Promise.all([
    db.select({ brokerId: leads.corretorId, inService: inServiceSql, firstContactsToday: contactsSql, firstContactCandidateCount: sql<number>`count(*) filter (where ${candidateWindowSql})::int`, firstContactCandidates: firstContactCandidatesSql })
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
    db.select({ id: schema.leadOffers.id, leadId: leads.id, leadName: leads.nome, brokerId: schema.leadOffers.brokerId, brokerName: schema.user.name, offeredAt: schema.leadOffers.offeredAt, expiresAt: schema.leadOffers.expiresAt, status: schema.leadOffers.status, leadStatus: leads.status, currentOwnerId: leads.corretorId, total: sql<number>`count(*) over()::int` })
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
    db.select({ id: schema.leadTasks.id, leadId: leads.id, leadName: leads.nome, brokerId: sql<string>`${schema.leadTasks.assignedTo}`, brokerName: schema.user.name, dueAt: schema.leadTasks.dueAt, completedAt: schema.leadTasks.completedAt, title: schema.leadTasks.title, total: sql<number>`count(*) over()::int` })
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

  const candidateRows: FirstContactCandidate[] = metricsRows.flatMap((row) => {
    const brokerId = row.brokerId;
    if (!brokerId || Number(row.firstContactCandidateCount ?? 0) === 0) return [];
    return parseCandidateAggregate(row.firstContactCandidates).map((candidate) => ({ ...candidate, brokerId }));
  });
  const brokerNameById = new Map(teamRows.map((row) => [row.id, row.name]));
  const firstContactItems = candidateRows.flatMap((row) => {
    const item = classifyFirstContact({
      leadId: row.leadId,
      name: row.name,
      brokerId: row.brokerId,
      brokerName: brokerNameById.get(row.brokerId) ?? "Corretor",
      status: row.status,
      sourceChannel: row.sourceChannel,
      sourceMetadata: row.sourceMetadata,
      assignedAt: nullableDate(row.assignedAt),
      firstContactAt: nullableDate(row.firstContactAt),
      stageEnteredAt: nullableDate(row.stageEnteredAt),
      hasAnyMessage: row.hasAnyMessage,
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
    offer_waiting: Number(offerRows[0]?.total ?? 0),
    first_contact_overdue: firstContactItems.length,
    return_overdue: Number(returnRows[0]?.total ?? 0),
  };
  const rawGroups = groupSupervisorPendencies([...offerItems, ...firstContactItems, ...returnItems]);
  const pendencies = rawGroups.map((group) => {
    const total = countsByReason[group.reason];
    return { ...group, count: total, remaining: Math.max(0, total - group.items.length) };
  });

  return { brokers: team, pendencies, updatedAt: now.toISOString() };
}
