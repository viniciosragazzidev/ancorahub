import "server-only";

import { and, count, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { getManagerUnitScope } from "@/features/broker-workspace/manager-unit-scope";
import { getManagerLiteLeads } from "@/features/supervisor-workspace/manager-lite-queries";

export type ManagerLiteTeamData = {
  unitBranchId: string | null;
  unitName: string | null;
  slaMinutes: number;
  counts: { brokers: number; inService: number; late: number };
  unassignedBrokers: Array<{ userId: string; name: string }>;
  supervisorInvites: Array<{ id: string; name: string; email: string; createdAt: string }>;
  members: Array<{
    id: string; userId: string | null; name: string; image: string | null; email: string;
    availability: string; status: "active" | "disabled" | "pending"; inviteId: string | null;
    inService: number; late: number;
  }>;
};

export async function getManagerLiteTeam(context: TenantContext): Promise<ManagerLiteTeamData> {
  if (context.role !== "manager") throw new Error("Esta lista está disponível apenas para gestores.");
  const scope = getManagerUnitScope(context);
  if (!scope) return { unitBranchId: null, unitName: null, slaMinutes: 15, counts: { brokers: 0, inService: 0, late: 0 }, unassignedBrokers: [], supervisorInvites: [], members: [] };
  const db = getDatabase();
  const [branchRows, rows, leadData, serviceRows, supervisorInviteRows] = await Promise.all([
    db.select({ name: schema.branches.name }).from(schema.branches).where(and(eq(schema.branches.id, scope.branchId), eq(schema.branches.tenantId, scope.tenantId))).limit(1),
    db.select({
      id: schema.brokerProfiles.id, userId: schema.brokerProfiles.userId,
      name: sql<string>`coalesce(${schema.user.name}, ${schema.brokerProfiles.professionalName})`,
      image: schema.user.image, email: sql<string>`coalesce(${schema.user.email}, ${schema.brokerProfiles.invitedEmail}, '')`,
      availability: schema.tenantMemberships.availabilityStatus,
      supervisorId: schema.tenantMemberships.supervisorId,
      memberStatus: schema.tenantMemberships.status, userStatus: schema.user.status,
      inviteId: schema.brokerInvitations.id,
    }).from(schema.brokerProfiles)
      .leftJoin(schema.user, eq(schema.user.id, schema.brokerProfiles.userId))
      .leftJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.brokerProfiles.userId), eq(schema.tenantMemberships.tenantId, scope.tenantId)))
      .leftJoin(schema.brokerInvitations, and(eq(schema.brokerInvitations.brokerProfileId, schema.brokerProfiles.id), eq(schema.brokerInvitations.tenantId, scope.tenantId), eq(schema.brokerInvitations.status, "PENDING")))
      .where(and(
        eq(schema.brokerProfiles.tenantId, scope.tenantId),
        or(
          and(eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.branchId, scope.branchId)),
          and(sql`${schema.tenantMemberships.id} is null`, eq(schema.brokerProfiles.branchId, scope.branchId), eq(schema.brokerInvitations.role, "broker")),
        ),
      )),
    getManagerLiteLeads(context),
    db.select({ brokerId: schema.leads.corretorId, total: count() }).from(schema.leads)
      .where(and(eq(schema.leads.tenantId, scope.tenantId), eq(schema.leads.branchId, scope.branchId), inArray(schema.leads.status, ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"]), isNotNull(schema.leads.corretorId), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt)))
      .groupBy(schema.leads.corretorId),
    db.select({ id: schema.brokerInvitations.id, name: schema.brokerProfiles.professionalName, email: sql<string>`coalesce(${schema.brokerInvitations.email}, ${schema.brokerProfiles.invitedEmail}, '')`, createdAt: schema.brokerInvitations.createdAt })
      .from(schema.brokerInvitations)
      .innerJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.id, schema.brokerInvitations.brokerProfileId), eq(schema.brokerProfiles.tenantId, scope.tenantId)))
      .where(and(
        eq(schema.brokerInvitations.tenantId, scope.tenantId),
        eq(schema.brokerInvitations.branchId, scope.branchId),
        eq(schema.brokerInvitations.role, "supervisor"),
        eq(schema.brokerInvitations.status, "PENDING"),
      ))
      .orderBy(desc(schema.brokerInvitations.createdAt)),
  ]);
  const activity = new Map(leadData.team.map((member) => [member.id, member]));
  const serviceByBroker = new Map(serviceRows.map((row) => [row.brokerId, Number(row.total)]));
  const members = rows.map((row) => ({
    id: row.userId ?? row.id,
    userId: row.userId,
    name: row.name ?? "Corretor",
    image: row.image ?? null,
    email: row.email,
    availability: row.availability ?? "offline",
    status: row.memberStatus === "inactive" || row.userStatus === "disabled" ? "disabled" as const : row.inviteId || !row.userId || row.userStatus === "pending" ? "pending" as const : "active" as const,
    inviteId: row.inviteId ?? null,
    inService: 0,
    late: 0,
  }));
  return {
    unitBranchId: scope.branchId,
    unitName: branchRows[0]?.name ?? null,
    slaMinutes: leadData.slaMinutes,
    unassignedBrokers: members.filter((member) => member.status === "active" && rows.find((row) => (row.userId ?? row.id) === member.id)?.supervisorId === null)
      .map((member) => ({ userId: member.userId!, name: member.name })),
    supervisorInvites: supervisorInviteRows.map((invite) => ({ ...invite, createdAt: invite.createdAt.toISOString() })),
    counts: {
      brokers: members.filter((member) => member.status === "active").length,
      inService: serviceRows.reduce((total, row) => total + Number(row.total), 0),
      late: leadData.team.reduce((total, member) => total + member.late, 0),
    },
    members: members.map((member) => {
      const memberActivity = member.userId ? activity.get(member.userId) : null;
      return { ...member, availability: memberActivity?.availability ?? member.availability, inService: member.userId ? serviceByBroker.get(member.userId) ?? 0 : 0, late: memberActivity?.late ?? 0 };
    }).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}
