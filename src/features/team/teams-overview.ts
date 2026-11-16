import "server-only";

import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { TEAM_LIST_SOURCE, teamListClientReplied } from "@/features/supervisor-workspace/lead-import/team-list-sql";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

/**
 * Equipes (16/11/2026): cada supervisora ativa é uma equipe (corretores com `supervisorId` = ela). A direção vê
 * a lista das equipes em /equipe?visao=equipes e, dentro de cada uma, os corretores, os leads enviados pela
 * empresa e os leads da lista importada pela supervisora. É o único lugar da gestão com toda a lista importada,
 * inclusive quem ainda não respondeu.
 */

const OPEN_STATUSES = ["new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis", "awaiting_reply"] as const;

export function canSeeTeams(context: TenantContext) {
  return context.role === "director" || (context.role === "manager" && Boolean(context.branchId));
}

/** Gestor só vê as equipes da unidade dele. */
const branchScope = (context: TenantContext) => (context.role === "manager" && context.branchId ? eq(schema.tenantMemberships.branchId, context.branchId) : undefined);

const notTeamList = sql`${schema.leads.sourceChannel} is distinct from ${TEAM_LIST_SOURCE}`;
const alive = and(isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt));
const importedBy = (supervisorIds: string[]) => and(
  eq(schema.leads.sourceChannel, TEAM_LIST_SOURCE),
  inArray(sql<string>`${schema.leads.sourceMetadata}->>'supervisorId'`, supervisorIds),
);

/** Nome e foto que a supervisora salvou no perfil da equipe; sem perfil, "Equipe <supervisora>". */
const teamJoin = and(eq(schema.supervisorTeams.supervisorId, schema.tenantMemberships.userId), eq(schema.supervisorTeams.tenantId, schema.tenantMemberships.tenantId));
const teamLabel = (teamName: string | null, supervisorName: string) => teamName?.trim() || `Equipe ${supervisorName}`;

export type TeamSummary = {
  supervisorId: string;
  teamName: string;
  teamImage: string | null;
  supervisorName: string;
  supervisorImage: string | null;
  branchName: string | null;
  brokers: number;
  companyOpen: number;
  listTotal: number;
  listPending: number;
  listReplied: number;
};

export async function listTeams(context: TenantContext): Promise<TeamSummary[]> {
  if (!canSeeTeams(context)) return [];
  const db = getDatabase();
  const supervisors = await db.select({
    id: schema.tenantMemberships.userId,
    name: schema.user.name,
    image: schema.user.image,
    branchName: schema.branches.name,
    teamName: schema.supervisorTeams.name,
    teamImage: schema.supervisorTeams.imageUrl,
  }).from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .leftJoin(schema.branches, eq(schema.branches.id, schema.tenantMemberships.branchId))
    .leftJoin(schema.supervisorTeams, teamJoin)
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId),
      eq(schema.tenantMemberships.role, "supervisor"),
      eq(schema.tenantMemberships.status, "active"),
      branchScope(context),
    ))
    .orderBy(asc(schema.user.name));
  if (!supervisors.length) return [];
  const ids = supervisors.map((supervisor) => supervisor.id);

  const supervisorOfLead = sql<string>`${schema.leads.sourceMetadata}->>'supervisorId'`;
  const [brokerRows, companyRows, listRows] = await Promise.all([
    db.select({ supervisorId: schema.tenantMemberships.supervisorId, total: count() }).from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), inArray(schema.tenantMemberships.supervisorId, ids)))
      .groupBy(schema.tenantMemberships.supervisorId),
    db.select({ supervisorId: schema.tenantMemberships.supervisorId, total: count() }).from(schema.leads)
      .innerJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.leads.corretorId), eq(schema.tenantMemberships.tenantId, schema.leads.tenantId)))
      .where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.tenantMemberships.supervisorId, ids), inArray(schema.leads.status, [...OPEN_STATUSES]), notTeamList, alive))
      .groupBy(schema.tenantMemberships.supervisorId),
    db.select({
      supervisorId: supervisorOfLead,
      total: count(),
      pending: sql<number>`count(*) filter (where ${schema.leads.corretorId} is null)`,
      replied: sql<number>`count(*) filter (where ${teamListClientReplied()})`,
    }).from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), importedBy(ids), alive))
      .groupBy(supervisorOfLead),
  ]);
  const brokers = new Map(brokerRows.map((row) => [row.supervisorId, Number(row.total)]));
  const company = new Map(companyRows.map((row) => [row.supervisorId, Number(row.total)]));
  const lists = new Map(listRows.map((row) => [row.supervisorId, row]));
  return supervisors.map((supervisor) => {
    const list = lists.get(supervisor.id);
    return {
      supervisorId: supervisor.id,
      teamName: teamLabel(supervisor.teamName, supervisor.name),
      teamImage: supervisor.teamImage,
      supervisorName: supervisor.name,
      supervisorImage: supervisor.image,
      branchName: supervisor.branchName,
      brokers: brokers.get(supervisor.id) ?? 0,
      companyOpen: company.get(supervisor.id) ?? 0,
      listTotal: Number(list?.total ?? 0),
      listPending: Number(list?.pending ?? 0),
      listReplied: Number(list?.replied ?? 0),
    };
  });
}

export type TeamBroker = { id: string; name: string; email: string; availability: string; companyOpen: number; listOpen: number };
export type TeamLeadRow = { id: string; name: string; phone: string; status: string; brokerName: string | null; date: string; replied: boolean };
export type TeamDetail = {
  supervisor: { id: string; name: string; email: string; image: string | null; branchName: string | null; availability: string };
  team: { name: string; image: string | null; description: string };
  brokers: TeamBroker[];
  companyLeads: TeamLeadRow[];
  listLeads: TeamLeadRow[];
  totals: { company: number; list: number; listPending: number; listReplied: number };
};

export async function getTeamDetail(context: TenantContext, supervisorId: string): Promise<TeamDetail | null> {
  if (!canSeeTeams(context)) return null;
  const db = getDatabase();
  const [supervisor] = await db.select({
    id: schema.tenantMemberships.userId,
    name: schema.user.name,
    email: schema.user.email,
    image: schema.user.image,
    branchName: schema.branches.name,
    availability: schema.tenantMemberships.availabilityStatus,
    teamName: schema.supervisorTeams.name,
    teamImage: schema.supervisorTeams.imageUrl,
    teamDescription: schema.supervisorTeams.description,
  }).from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .leftJoin(schema.branches, eq(schema.branches.id, schema.tenantMemberships.branchId))
    .leftJoin(schema.supervisorTeams, teamJoin)
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId),
      eq(schema.tenantMemberships.userId, supervisorId),
      eq(schema.tenantMemberships.role, "supervisor"),
      branchScope(context),
    )).limit(1);
  if (!supervisor) return null;

  const members = await db.select({
    id: schema.tenantMemberships.userId,
    name: schema.user.name,
    email: schema.user.email,
    availability: schema.tenantMemberships.availabilityStatus,
  }).from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.supervisorId, supervisorId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active")))
    .orderBy(asc(schema.user.name));
  const brokerIds = members.map((member) => member.id);
  const replied = teamListClientReplied();
  const ownList = and(eq(schema.leads.tenantId, context.tenantId), importedBy([supervisorId]), alive);

  const [perBroker, companyLeads, listLeads, [listTotals], [companyTotal]] = await Promise.all([
    brokerIds.length ? db.select({
      brokerId: schema.leads.corretorId,
      company: sql<number>`count(*) filter (where ${notTeamList})`,
      list: sql<number>`count(*) filter (where ${schema.leads.sourceChannel} = ${TEAM_LIST_SOURCE})`,
    }).from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.corretorId, brokerIds), inArray(schema.leads.status, [...OPEN_STATUSES]), alive))
      .groupBy(schema.leads.corretorId) : Promise.resolve([]),
    brokerIds.length ? db.select({
      id: schema.leads.id, name: schema.leads.nome, phone: schema.leads.telefone, status: schema.leads.status,
      brokerName: schema.user.name, date: sql<Date>`coalesce(${schema.leads.assignedAt}, ${schema.leads.createdAt})`,
    }).from(schema.leads)
      .leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId))
      .where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.corretorId, brokerIds), notTeamList, alive))
      .orderBy(desc(sql`coalesce(${schema.leads.assignedAt}, ${schema.leads.createdAt})`))
      .limit(500) : Promise.resolve([]),
    db.select({
      id: schema.leads.id, name: schema.leads.nome, phone: schema.leads.telefone, status: schema.leads.status,
      brokerName: schema.user.name, date: schema.leads.createdAt, replied: sql<boolean>`${replied}`,
    }).from(schema.leads)
      .leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId))
      .where(ownList)
      .orderBy(desc(schema.leads.createdAt))
      .limit(2000),
    db.select({
      total: count(),
      pending: sql<number>`count(*) filter (where ${schema.leads.corretorId} is null)`,
      replied: sql<number>`count(*) filter (where ${replied})`,
    }).from(schema.leads).where(ownList),
    brokerIds.length ? db.select({ total: count() }).from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.corretorId, brokerIds), notTeamList, alive)) : Promise.resolve([{ total: 0 }]),
  ]);
  const counts = new Map(perBroker.map((row) => [row.brokerId, row]));
  const iso = (value: Date | string) => (value instanceof Date ? value.toISOString() : new Date(value).toISOString());
  return {
    supervisor: { id: supervisor.id, name: supervisor.name, email: supervisor.email, image: supervisor.image, branchName: supervisor.branchName, availability: supervisor.availability ?? "available" },
    team: { name: teamLabel(supervisor.teamName, supervisor.name), image: supervisor.teamImage, description: supervisor.teamDescription ?? "" },
    brokers: members.map((member) => ({
      ...member,
      availability: member.availability ?? "available",
      companyOpen: Number(counts.get(member.id)?.company ?? 0),
      listOpen: Number(counts.get(member.id)?.list ?? 0),
    })),
    companyLeads: companyLeads.map((lead) => ({ ...lead, date: iso(lead.date), replied: false })),
    listLeads: listLeads.map((lead) => ({ ...lead, date: iso(lead.date), replied: Boolean(lead.replied) })),
    totals: {
      company: Number(companyTotal?.total ?? 0),
      list: Number(listTotals?.total ?? 0),
      listPending: Number(listTotals?.pending ?? 0),
      listReplied: Number(listTotals?.replied ?? 0),
    },
  };
}
