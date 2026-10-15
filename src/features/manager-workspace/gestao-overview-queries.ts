import "server-only";

import { and, eq } from "drizzle-orm";

import { getManagerUnitScope } from "@/features/broker-workspace/manager-unit-scope";
import type { OverviewSupervisor } from "@/features/team-management-ui/build-overview";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

export type ManagerUnitIdentity = {
  activeBrokers: number;
  supervisors: OverviewSupervisor[];
  unassigned: Array<{ userId: string; name: string }>;
};

/**
 * Identidade da unidade para /gestao: supervisores ativos com o nome da equipe, corretores ativos por supervisor
 * e os que não têm supervisor. Escopo = a unidade da sessão do gestor (nunca um branchId vindo da URL).
 */
export async function getManagerUnitIdentity(context: TenantContext): Promise<ManagerUnitIdentity> {
  const scope = getManagerUnitScope(context);
  if (!scope) return { activeBrokers: 0, supervisors: [], unassigned: [] };
  const db = getDatabase();

  const [supervisorRows, teamRows, brokerRows] = await Promise.all([
    db.select({ userId: schema.tenantMemberships.userId, name: schema.user.name, image: schema.user.image })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(
        eq(schema.tenantMemberships.tenantId, scope.tenantId),
        eq(schema.tenantMemberships.branchId, scope.branchId),
        eq(schema.tenantMemberships.role, "supervisor"),
        eq(schema.tenantMemberships.status, "active"),
      )),
    db.select({ supervisorId: schema.supervisorTeams.supervisorId, name: schema.supervisorTeams.name })
      .from(schema.supervisorTeams)
      .where(and(eq(schema.supervisorTeams.tenantId, scope.tenantId), eq(schema.supervisorTeams.branchId, scope.branchId))),
    db.select({ userId: schema.tenantMemberships.userId, supervisorId: schema.tenantMemberships.supervisorId, name: schema.user.name })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(
        eq(schema.tenantMemberships.tenantId, scope.tenantId),
        eq(schema.tenantMemberships.branchId, scope.branchId),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
      )),
  ]);

  const teamNameBySupervisor = new Map(teamRows.map((row) => [row.supervisorId, row.name]));
  const brokersBySupervisor = new Map<string, number>();
  const unassigned: Array<{ userId: string; name: string }> = [];
  for (const broker of brokerRows) {
    if (broker.supervisorId) {
      brokersBySupervisor.set(broker.supervisorId, (brokersBySupervisor.get(broker.supervisorId) ?? 0) + 1);
    } else {
      unassigned.push({ userId: broker.userId, name: broker.name ?? "Corretor" });
    }
  }

  return {
    activeBrokers: brokerRows.length,
    supervisors: supervisorRows.map((row) => ({
      supervisorId: row.userId,
      name: row.name ?? "Supervisor",
      image: row.image ?? null,
      teamName: teamNameBySupervisor.get(row.userId) ?? null,
      brokers: brokersBySupervisor.get(row.userId) ?? 0,
    })),
    unassigned,
  };
}

