import "server-only";

import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import { getTeamOfferStats, statsWindow } from "@/features/engagement/broker-stats";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getManagerUnitScope } from "@/features/broker-workspace/manager-unit-scope";
import { getSupervisorWorkspaceData } from "@/features/supervisor-workspace/queries";
import { inSupervisorTeam, isSupervisorTeamScoped } from "@/features/team/supervisor-scope";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { addDays, zonedMidnight } from "@/features/lead-distribution/monthly-duty-plan";

const TZ = "America/Sao_Paulo";
const TEAM_ACTIVE = ["distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;

function localDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
}

export type SupervisorRadarLead = {
  id: string;
  name: string;
  status: string;
  ownerId: string;
  ownerName: string;
  ownerImage: string | null;
  productName: string | null;
  assignedAt: Date | null;
  firstContactAt: Date | null;
  stageEnteredAt: Date | null;
};

export async function getSupervisorLiteRadar(context: TenantContext, now = new Date()) {
  if (!isSupervisorTeamScoped(context) || !context.branchId) throw new Error("A equipe não está disponível neste escopo.");
  const workspace = await getSupervisorWorkspaceData(context, now);
  const brokerIds = workspace.team.map((broker) => broker.userId);
  if (!brokerIds.length) return { team: [], leads: [], funnel: { new: 0, firstContact: 0, service: 0, quote: 0, closing: 0 }, slaMinutes: workspace.slaMinutes };

  const db = getDatabase();
  const ownerRows = await db.select({ id: schema.tenantMemberships.userId, name: schema.user.name, image: schema.user.image, availability: schema.tenantMemberships.availabilityStatus })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId),
      eq(schema.tenantMemberships.supervisorId, context.userId),
      eq(schema.tenantMemberships.branchId, context.branchId),
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.status, "active"),
      inArray(schema.tenantMemberships.userId, brokerIds),
    ));
  const ownerById = new Map(ownerRows.map((row) => [row.id, row]));
  const [leadRows, statusRows, firstContactRows] = await Promise.all([
    db.select({
      id: schema.leads.id,
      name: schema.leads.nome,
      phone: schema.leads.telefone,
      status: schema.leads.status,
      ownerId: sql<string>`${schema.leads.corretorId}`,
      ownerName: schema.user.name,
      productName: schema.carrierPlans.name,
      assignedAt: schema.leads.assignedAt,
      firstContactAt: schema.leads.firstContactAt,
      stageEnteredAt: schema.leads.stageEnteredAt,
    }).from(schema.leads)
      .innerJoin(schema.user, eq(schema.user.id, schema.leads.corretorId))
      .leftJoin(schema.carrierPlans, eq(schema.carrierPlans.id, schema.leads.planId))
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        inArray(schema.leads.corretorId, brokerIds),
        inSupervisorTeam(schema.leads.corretorId, context.tenantId, context.userId),
        inArray(schema.leads.status, [...TEAM_ACTIVE]),
        isNull(schema.leads.deletedAt),
        isNull(schema.leads.archivedAt),
      ))
      .orderBy(desc(schema.leads.assignedAt), desc(schema.leads.createdAt))
      .limit(500),
    db.select({ status: schema.leads.status, total: count() }).from(schema.leads)
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        inArray(schema.leads.corretorId, brokerIds),
        inSupervisorTeam(schema.leads.corretorId, context.tenantId, context.userId),
        isNull(schema.leads.deletedAt),
        isNull(schema.leads.archivedAt),
      )).groupBy(schema.leads.status),
    db.select({ total: count() }).from(schema.leads).where(and(
      eq(schema.leads.tenantId, context.tenantId),
      inArray(schema.leads.corretorId, brokerIds),
      inSupervisorTeam(schema.leads.corretorId, context.tenantId, context.userId),
      inArray(schema.leads.status, [...TEAM_ACTIVE]),
      isNotNull(schema.leads.firstContactAt),
      isNull(schema.leads.deletedAt),
      isNull(schema.leads.archivedAt),
    )),
  ]);

  const counts = new Map(statusRows.map((row) => [row.status, Number(row.total)]));
  const firstContact = Number(firstContactRows[0]?.total ?? 0);
  return {
    team: workspace.team.map((broker) => {
      const owner = ownerById.get(broker.userId);
      return {
        id: broker.userId,
        name: owner?.name ?? broker.name,
        image: owner?.image ?? null,
        availability: owner?.availability ?? broker.availability,
        openCount: broker.inService + broker.waiting,
        late: broker.late,
      };
    }),
    leads: leadRows.map((lead) => ({ ...lead, ownerImage: ownerById.get(lead.ownerId)?.image ?? null })),
    funnel: {
      new: Number(counts.get("new") ?? 0) + Number(counts.get("distributed") ?? 0),
      firstContact,
      service: Number(counts.get("in_contact") ?? 0),
      quote: Number(counts.get("quote_sent") ?? 0),
      closing: Number(counts.get("negotiation") ?? 0) + Number(counts.get("documentation_pending") ?? 0) + Number(counts.get("under_analysis") ?? 0),
    },
    slaMinutes: workspace.slaMinutes,
  };
}

export async function getSupervisorLiteMemberPulse(input: {
  context: TenantContext;
  memberId: string;
  slaMinutes: number;
  now?: Date;
}) {
  const { context, memberId, slaMinutes, now = new Date() } = input;
  const isSupervisor = context.role === "supervisor" && isSupervisorTeamScoped(context) && context.supervisorTeamScope;
  const managerScope = getManagerUnitScope(context);
  if ((!isSupervisor && !managerScope) || !context.branchId || (await getLiteAudience(context)) !== (isSupervisor ? "supervisor" : "manager")) throw new Error("A equipe não está disponível neste escopo.");
  const db = getDatabase();
  const [membership] = await db.select({ id: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId),
      eq(schema.tenantMemberships.userId, memberId),
      eq(schema.tenantMemberships.branchId, context.branchId),
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.status, "active"),
      isSupervisor ? eq(schema.tenantMemberships.supervisorId, context.userId) : undefined,
    )).limit(1);
  if (!membership) throw new Error("Corretor fora da equipe.");

  const todayKey = localDateKey(now);
  const todayStart = zonedMidnight(todayKey, TZ);
  const tomorrowStart = zonedMidnight(addDays(todayKey, 1), TZ);
  const chartStart = zonedMidnight(addDays(todayKey, -6), TZ);
  const acceptedDay = sql<string>`to_char(${schema.leadOffers.acceptedAt} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`;
  const leadScope = and(
    eq(schema.leads.tenantId, context.tenantId),
    eq(schema.leads.corretorId, memberId),
    isSupervisor ? inSupervisorTeam(schema.leads.corretorId, context.tenantId, context.userId) : eq(schema.leads.branchId, context.branchId),
    isNull(schema.leads.deletedAt),
    isNull(schema.leads.archivedAt),
  );
  const teamIds = (await db.select({ id: schema.tenantMemberships.userId }).from(schema.tenantMemberships).where(and(
    eq(schema.tenantMemberships.tenantId, context.tenantId),
    eq(schema.tenantMemberships.branchId, context.branchId),
    eq(schema.tenantMemberships.role, "broker"),
    eq(schema.tenantMemberships.status, "active"),
    isSupervisor ? eq(schema.tenantMemberships.supervisorId, context.userId) : undefined,
  ))).map((row) => row.id);
  const [todayRows, acceptedRows, funnelRows, attentionRows, teamStats] = await Promise.all([
    db.select({
      received: sql<number>`count(*) filter (where ${schema.leads.assignedAt} >= ${todayStart.toISOString()}::timestamptz and ${schema.leads.assignedAt} < ${tomorrowStart.toISOString()}::timestamptz)::int`,
      accepted: sql<number>`count(*) filter (where ${schema.leads.id} in (select ${schema.leadOffers.leadId} from ${schema.leadOffers} where ${schema.leadOffers.tenantId} = ${context.tenantId} and ${schema.leadOffers.brokerId} = ${memberId} and ${schema.leadOffers.status} = 'ACCEPTED' and ${schema.leadOffers.acceptedAt} >= ${todayStart.toISOString()}::timestamptz and ${schema.leadOffers.acceptedAt} < ${tomorrowStart.toISOString()}::timestamptz))::int`,
      inService: sql<number>`count(*) filter (where ${inArray(schema.leads.status, ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"])})::int`,
      late: sql<number>`count(*) filter (where ${schema.leads.firstContactAt} is null and ${schema.leads.assignedAt} < ${now.toISOString()}::timestamptz - (${slaMinutes} * interval '1 minute'))::int`,
      onTimeTotal: sql<number>`count(*) filter (where ${schema.leads.firstContactAt} >= ${chartStart.toISOString()}::timestamptz and ${schema.leads.firstContactAt} < ${tomorrowStart.toISOString()}::timestamptz)::int`,
      onTime: sql<number>`count(*) filter (where ${schema.leads.firstContactAt} >= ${chartStart.toISOString()}::timestamptz and ${schema.leads.firstContactAt} < ${tomorrowStart.toISOString()}::timestamptz and ${schema.leads.assignedAt} is not null and ${schema.leads.firstContactAt} <= ${schema.leads.assignedAt} + (${slaMinutes} * interval '1 minute'))::int`,
    }).from(schema.leads).where(leadScope),
    db.select({ day: acceptedDay, total: count() }).from(schema.leadOffers).innerJoin(schema.leads, and(eq(schema.leads.id, schema.leadOffers.leadId), eq(schema.leads.tenantId, context.tenantId)))
      .where(and(
        eq(schema.leadOffers.tenantId, context.tenantId),
        eq(schema.leadOffers.brokerId, memberId),
        eq(schema.leadOffers.status, "ACCEPTED"),
        gte(schema.leadOffers.acceptedAt, chartStart),
        lt(schema.leadOffers.acceptedAt, tomorrowStart),
        eq(schema.leads.branchId, context.branchId),
      )).groupBy(acceptedDay),
    db.select({ status: schema.leads.status, total: count() }).from(schema.leads).where(leadScope).groupBy(schema.leads.status),
    db.select({ id: schema.leads.id, name: schema.leads.nome, status: schema.leads.status, assignedAt: schema.leads.assignedAt, stageEnteredAt: schema.leads.stageEnteredAt, firstContactAt: schema.leads.firstContactAt })
      .from(schema.leads).where(and(
        leadScope,
        or(
          and(isNull(schema.leads.firstContactAt), lt(schema.leads.assignedAt, new Date(now.getTime() - slaMinutes * 60_000))),
          and(inArray(schema.leads.status, ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"]), lt(schema.leads.stageEnteredAt, new Date(now.getTime() - 3 * 86_400_000))),
        ),
      )).orderBy(asc(schema.leads.assignedAt)).limit(10),
    getTeamOfferStats(context.tenantId, statsWindow(now), teamIds),
  ]);
  const acceptedByDay = new Map(acceptedRows.map((row) => [row.day, Number(row.total)]));
  const funnelByStatus = new Map(funnelRows.map((row) => [row.status, Number(row.total)]));
  const teamMedians = teamStats.filter((row) => teamIds.includes(row.brokerId) && row.medianAcceptSeconds !== null).map((row) => row.medianAcceptSeconds!);
  const memberMedian = teamStats.find((row) => row.brokerId === memberId)?.medianAcceptSeconds ?? null;
  const teamMedianAverage = teamMedians.length ? teamMedians.reduce((sum, value) => sum + value, 0) / teamMedians.length : null;
  const today = todayRows[0];

  return {
    today: {
      received: Number(today?.received ?? 0),
      accepted: Number(today?.accepted ?? 0),
      inService: Number(today?.inService ?? 0),
      late: Number(today?.late ?? 0),
    },
    week: Array.from({ length: 7 }, (_, index) => {
      const dateKey = addDays(todayKey, index - 6);
      const date = zonedMidnight(dateKey, TZ);
      return { date: dateKey, label: new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "short" }).format(date).replace(".", ""), accepted: acceptedByDay.get(dateKey) ?? 0 };
    }),
    medianAcceptSeconds: memberMedian === null ? null : Number(memberMedian),
    teamMedianSeconds: teamMedianAverage,
    onTimeContactRate: Number(today?.onTimeTotal ?? 0) ? Math.round(Number(today?.onTime ?? 0) / Number(today?.onTimeTotal) * 100) : null,
    funnel: [
      { status: "distributed", label: "Novos", total: Number(funnelByStatus.get("new") ?? 0) + Number(funnelByStatus.get("distributed") ?? 0) },
      { status: "in_contact", label: "Em atendimento", total: Number(funnelByStatus.get("in_contact") ?? 0) },
      { status: "quote_sent", label: "Cotações", total: Number(funnelByStatus.get("quote_sent") ?? 0) },
      { status: "negotiation", label: "Negociação", total: Number(funnelByStatus.get("negotiation") ?? 0) },
      { status: "documentation_pending", label: "Documentação", total: Number(funnelByStatus.get("documentation_pending") ?? 0) },
    ],
    attention: attentionRows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      assignedAt: row.assignedAt?.toISOString() ?? null,
      stageEnteredAt: row.stageEnteredAt?.toISOString() ?? null,
      firstContactAt: row.firstContactAt?.toISOString() ?? null,
    })),
  };
}
