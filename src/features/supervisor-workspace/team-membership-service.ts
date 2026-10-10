import "server-only";

import { randomUUID } from "node:crypto";

import { and, count, eq, isNull } from "drizzle-orm";

import { SUPERVISOR_MAX_BROKERS } from "@/features/team/supervised-brokers";
import { getDatabase, schema } from "@/shared/db";
import type { getRequiredTenantContext } from "@/shared/auth/tenant-context";

type Tx = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];
type TeamActor = Awaited<ReturnType<typeof getRequiredTenantContext>>;

/** Atomic shared rule for direct P2 adds and accepted P10 invitations. */
export async function addBrokerToSupervisorTeam(tx: Tx, input: {
  tenantId: string;
  branchId: string;
  supervisorId: string;
  brokerId: string;
  actor: TeamActor;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const memberships = schema.tenantMemberships;
  const [supervisor] = await tx.select({ id: memberships.id }).from(memberships)
    .where(and(
      eq(memberships.tenantId, input.tenantId),
      eq(memberships.userId, input.supervisorId),
      eq(memberships.role, "supervisor"),
      eq(memberships.status, "active"),
      eq(memberships.branchId, input.branchId),
    )).for("update");
  if (!supervisor) return { ok: false, reason: "O supervisor não está ativo nesta unidade." };

  const [activeCount] = await tx.select({ total: count() }).from(memberships)
    .where(and(
      eq(memberships.tenantId, input.tenantId),
      eq(memberships.supervisorId, input.supervisorId),
      eq(memberships.branchId, input.branchId),
      eq(memberships.role, "broker"),
      eq(memberships.status, "active"),
    ));
  if (Number(activeCount?.total ?? 0) >= SUPERVISOR_MAX_BROKERS) {
    return { ok: false, reason: `Sua equipe já tem ${SUPERVISOR_MAX_BROKERS} corretores.` };
  }

  const [available] = await tx.select({ userId: memberships.userId }).from(memberships)
    .innerJoin(schema.user, eq(schema.user.id, memberships.userId))
    .where(and(
      eq(memberships.tenantId, input.tenantId),
      eq(memberships.userId, input.brokerId),
      eq(memberships.branchId, input.branchId),
      eq(memberships.role, "broker"),
      eq(memberships.status, "active"),
      eq(schema.user.status, "active"),
      eq(schema.user.active, true),
      isNull(memberships.supervisorId),
    )).limit(1);
  if (!available) return { ok: false, reason: "Esse corretor não está mais livre na sua unidade." };

  const rows = await tx.update(memberships).set({ supervisorId: input.supervisorId, updatedAt: new Date() })
    .where(and(
      eq(memberships.tenantId, input.tenantId),
      eq(memberships.userId, input.brokerId),
      eq(memberships.role, "broker"),
      eq(memberships.status, "active"),
      eq(memberships.branchId, input.branchId),
      isNull(memberships.supervisorId),
    ))
    .returning({ userId: memberships.userId });
  if (!rows.length) return { ok: false, reason: "Esse corretor acabou de entrar em outra equipe." };

  await tx.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: input.actor.userId,
    entidade: "supervisor_team",
    entidadeId: input.supervisorId,
    acao: `supervisor_team.member_added:${input.brokerId}`,
  });
  return { ok: true };
}
