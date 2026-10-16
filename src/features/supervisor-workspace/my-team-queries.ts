import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getSupervisorWorkspaceData, type TeamDuty } from "@/features/supervisor-workspace/queries";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { teamLeaderboard } from "@/features/engagement/leaderboard-queries";

export type SupervisorTeamPageData = {
  branchId: string;
  branchName: string | null;
  team: { name: string; description: string; imageUrl: string | null } | null;
  ranking: { position: number; positionChange: number | null } | null;
  overview: { brokers: number; inService: number; late: number };
  members: Array<{ id: string; name: string; imageUrl: string | null; availability: string; receivedToday: number; inService: number; late: number }>;
  invites: Array<{ id: string; brokerId: string; brokerName: string; createdAt: string }>;
  pendingAccessInvites: Array<{ id: string; brokerProfileId: string; brokerName: string; email: string | null; createdAt: string }>;
  brokers: Array<{ id: string; name: string; imageUrl: string | null; supervisorId: string | null; supervisorName: string | null; inviteId: string | null }>;
  /** Quem da equipe está de plantão agora. */
  onDuty?: TeamDuty[];
};

export async function getSupervisorTeamPageData(): Promise<SupervisorTeamPageData> {
  const context = await getRequiredTenantContext();
  if (context.role !== "supervisor" || !context.supervisorTeamScope || !context.branchId || (await getLiteAudience(context)) !== "supervisor") {
    throw new Error("Esta área está disponível apenas para supervisores Lite.");
  }

  const db = getDatabase();
  const [branchRows, teamRows, memberRows, inviteRows, pendingAccessRows, brokerRows, workspace] = await Promise.all([
    db.select({ name: schema.branches.name }).from(schema.branches)
      .where(and(eq(schema.branches.id, context.branchId), eq(schema.branches.tenantId, context.tenantId))).limit(1),
    db.select({ name: schema.supervisorTeams.name, description: schema.supervisorTeams.description, imageUrl: schema.supervisorTeams.imageUrl })
      .from(schema.supervisorTeams)
      .where(and(eq(schema.supervisorTeams.tenantId, context.tenantId), eq(schema.supervisorTeams.supervisorId, context.userId), eq(schema.supervisorTeams.branchId, context.branchId)))
      .limit(1),
    db.select({ id: schema.tenantMemberships.userId, name: schema.user.name, imageUrl: schema.user.image })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        eq(schema.tenantMemberships.branchId, context.branchId),
        eq(schema.tenantMemberships.supervisorId, context.userId),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
        eq(schema.user.status, "active"),
        eq(schema.user.active, true),
      )).orderBy(asc(schema.user.name)),
    db.select({ id: schema.supervisorTeamInvites.id, brokerId: schema.supervisorTeamInvites.brokerId, brokerName: schema.user.name, createdAt: schema.supervisorTeamInvites.createdAt })
      .from(schema.supervisorTeamInvites)
      .innerJoin(schema.user, eq(schema.user.id, schema.supervisorTeamInvites.brokerId))
      .where(and(eq(schema.supervisorTeamInvites.tenantId, context.tenantId), eq(schema.supervisorTeamInvites.supervisorId, context.userId), eq(schema.supervisorTeamInvites.status, "pending")))
      .orderBy(desc(schema.supervisorTeamInvites.createdAt)),
    db.select({
      id: schema.brokerInvitations.id,
      brokerProfileId: schema.brokerProfiles.id,
      brokerName: schema.brokerProfiles.professionalName,
      email: schema.brokerInvitations.email,
      createdAt: schema.brokerInvitations.createdAt,
    }).from(schema.brokerInvitations)
      .innerJoin(schema.brokerProfiles, and(
        eq(schema.brokerProfiles.id, schema.brokerInvitations.brokerProfileId),
        eq(schema.brokerProfiles.tenantId, context.tenantId),
      ))
      .where(and(
        eq(schema.brokerInvitations.tenantId, context.tenantId),
        eq(schema.brokerInvitations.branchId, context.branchId),
        eq(schema.brokerInvitations.role, "broker"),
        eq(schema.brokerInvitations.supervisorId, context.userId),
        eq(schema.brokerInvitations.status, "PENDING"),
        eq(schema.brokerProfiles.branchId, context.branchId),
      )).orderBy(desc(schema.brokerInvitations.createdAt)),
    db.select({ id: schema.tenantMemberships.userId, name: schema.user.name, imageUrl: schema.user.image, supervisorId: schema.tenantMemberships.supervisorId })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        eq(schema.tenantMemberships.branchId, context.branchId),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
        eq(schema.user.status, "active"),
        eq(schema.user.active, true),
      )).orderBy(asc(schema.user.name)),
    getSupervisorWorkspaceData(context),
  ]);
  const rankingEnabled = await getFeatureFlag(FEATURE_FLAGS.TEAM_RANKING).catch(() => "false") === "true";
  const leaderboard = rankingEnabled
    ? await teamLeaderboard(context.tenantId, context.branchId).catch(() => null)
    : null;
  const teamStanding = leaderboard?.teams.find((team) => team.supervisorId === context.userId);
  const supervisorIds = [...new Set(brokerRows.map((row) => row.supervisorId).filter((id): id is string => Boolean(id) && id !== context.userId))];
  const supervisorRows = supervisorIds.length ? await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user)
    .innerJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.user.id), eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.role, "supervisor"), eq(schema.tenantMemberships.status, "active")))
    .where(and(eq(schema.user.status, "active"), eq(schema.user.active, true), inArray(schema.user.id, supervisorIds))) : [];
  const supervisorNameById = new Map(supervisorRows.map((row) => [row.id, row.name]));
  const pendingInviteByBroker = new Map(inviteRows.map((row) => [row.brokerId, row.id]));

  return {
    onDuty: workspace.duty,
    branchId: context.branchId,
    branchName: branchRows[0]?.name ?? null,
    team: teamRows[0] ?? null,
    ranking: teamStanding ? { position: teamStanding.position, positionChange: teamStanding.positionChange } : null,
    overview: {
      brokers: workspace.team.length,
      inService: workspace.today.inService,
      late: workspace.today.late,
    },
    members: memberRows.map((member) => {
      const activity = workspace.team.find((broker) => broker.userId === member.id);
      return {
        ...member,
        availability: activity?.availability ?? "offline",
        receivedToday: activity?.receivedToday ?? 0,
        inService: activity?.inService ?? 0,
        late: activity?.late ?? 0,
      };
    }).sort((a, b) => Number(b.late > 0) - Number(a.late > 0) || b.late - a.late || a.name.localeCompare(b.name, "pt-BR")),
    invites: inviteRows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    pendingAccessInvites: pendingAccessRows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    brokers: brokerRows.filter((row) => row.supervisorId !== context.userId).map((row) => ({
      ...row,
      supervisorName: row.supervisorId ? supervisorNameById.get(row.supervisorId) ?? "Outra equipe" : null,
      inviteId: pendingInviteByBroker.get(row.id) ?? null,
    })),
  };
}

export async function getMySupervisorTeamIdentity(): Promise<{ name: string; imageUrl: string | null } | null> {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") return null;
  const [membership] = await getDatabase().select({ supervisorId: schema.tenantMemberships.supervisorId })
    .from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, context.userId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active")))
    .limit(1);
  if (!membership?.supervisorId) return null;
  const [team] = await getDatabase().select({ name: schema.supervisorTeams.name, imageUrl: schema.supervisorTeams.imageUrl })
    .from(schema.supervisorTeams)
    .where(and(eq(schema.supervisorTeams.tenantId, context.tenantId), eq(schema.supervisorTeams.supervisorId, membership.supervisorId)))
    .limit(1);
  return team ?? null;
}

export async function getMyPendingSupervisorInvites() {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") return [];
  return getDatabase().select({
    id: schema.supervisorTeamInvites.id,
    teamName: schema.supervisorTeams.name,
    teamImageUrl: schema.supervisorTeams.imageUrl,
    supervisorId: schema.supervisorTeamInvites.supervisorId,
    createdAt: schema.supervisorTeamInvites.createdAt,
    message: schema.supervisorTeamInvites.message,
  }).from(schema.supervisorTeamInvites)
    .leftJoin(schema.supervisorTeams, and(eq(schema.supervisorTeams.tenantId, schema.supervisorTeamInvites.tenantId), eq(schema.supervisorTeams.supervisorId, schema.supervisorTeamInvites.supervisorId)))
    .where(and(eq(schema.supervisorTeamInvites.tenantId, context.tenantId), eq(schema.supervisorTeamInvites.brokerId, context.userId), eq(schema.supervisorTeamInvites.status, "pending")))
    .orderBy(desc(schema.supervisorTeamInvites.createdAt));
}
