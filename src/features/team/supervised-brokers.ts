import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNotNull, notInArray } from "drizzle-orm";
import { z } from "zod";

import { schema } from "@/shared/db";
import type { getDatabase } from "@/shared/db";

/** A supervisor looks after a limited team (Vinicios, 2026-10-10). */
export const SUPERVISOR_MAX_BROKERS = 30;

type Tx = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];

/** The form sends the chosen brokers as JSON in "supervisedBrokerIds" (present only when the field is shown). */
export const supervisedBrokersField = z.preprocess(
  (value) => {
    if (typeof value !== "string" || !value) return undefined;
    try { return JSON.parse(value); } catch { return undefined; }
  },
  z.array(z.string().min(1).max(80)).max(SUPERVISOR_MAX_BROKERS, `Um supervisor pode acompanhar até ${SUPERVISOR_MAX_BROKERS} corretores.`).optional(),
);

/**
 * Sets which brokers a supervisor supervises (tenant_memberships.supervisor_id).
 * Only active brokers of the same tenant and, when the supervisor has a unit,
 * of that unit. Brokers left out stop pointing to this supervisor.
 */
export async function syncSupervisedBrokers(tx: Tx, input: { tenantId: string; actorId: string; supervisorUserId: string; supervisorBranchId: string | null; brokerUserIds: string[] }) {
  const memberships = schema.tenantMemberships;
  const wanted = [...new Set(input.brokerUserIds)].filter((id) => id !== input.supervisorUserId);
  if (wanted.length > SUPERVISOR_MAX_BROKERS) throw new Error(`Um supervisor pode acompanhar até ${SUPERVISOR_MAX_BROKERS} corretores.`);

  if (wanted.length) {
    const valid = await tx.select({ userId: memberships.userId, branchId: memberships.branchId, supervisorId: memberships.supervisorId }).from(memberships)
      .where(and(eq(memberships.tenantId, input.tenantId), inArray(memberships.userId, wanted), eq(memberships.role, "broker"), eq(memberships.status, "active")));
    if (valid.length !== wanted.length) throw new Error("Escolha só corretores ativos desta empresa.");
    if (input.supervisorBranchId && valid.some((row) => row.branchId !== input.supervisorBranchId)) {
      throw new Error("O supervisor só acompanha corretores da unidade dele.");
    }
    // A broker taken from another supervisor: that supervisor's team history records it too.
    const taken = valid.filter((row) => row.supervisorId && row.supervisorId !== input.supervisorUserId);
    for (const previous of new Set(taken.map((row) => row.supervisorId!))) {
      const count = taken.filter((row) => row.supervisorId === previous).length;
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.actorId, entidade: "supervisor_team", entidadeId: previous, acao: `perdeu ${count} corretor(es) para outro supervisor` });
    }
    await tx.update(memberships).set({ supervisorId: input.supervisorUserId, updatedAt: new Date() })
      .where(and(eq(memberships.tenantId, input.tenantId), inArray(memberships.userId, wanted)));
  }
  await tx.update(memberships).set({ supervisorId: null, updatedAt: new Date() })
    .where(and(
      eq(memberships.tenantId, input.tenantId),
      eq(memberships.supervisorId, input.supervisorUserId),
      wanted.length ? notInArray(memberships.userId, wanted) : undefined,
    ));
  await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.actorId, entidade: "supervisor_team", entidadeId: input.supervisorUserId, acao: `definiu a equipe do supervisor (${wanted.length} corretores)` });
}

/** A member that stops being supervisor leaves no broker pointing to them. */
export async function clearSupervisedBrokers(tx: Tx, input: { tenantId: string; actorId: string; supervisorUserId: string }) {
  const cleared = await tx.update(schema.tenantMemberships).set({ supervisorId: null, updatedAt: new Date() })
    .where(and(eq(schema.tenantMemberships.tenantId, input.tenantId), eq(schema.tenantMemberships.supervisorId, input.supervisorUserId)))
    .returning({ id: schema.tenantMemberships.id });
  if (cleared.length) {
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.actorId, entidade: "supervisor_team", entidadeId: input.supervisorUserId, acao: `desfez a equipe do supervisor (${cleared.length} corretores)` });
  }
}

/**
 * A member deactivated or removed leaves no team link behind: a broker stops
 * pointing to a supervisor, and a supervisor's brokers stop pointing to them
 * (stale links would leak scope once the supervisor sees "their team").
 */
export async function detachFromSupervision(tx: Tx, input: { tenantId: string; actorId: string; userId: string }) {
  await tx.update(schema.tenantMemberships).set({ supervisorId: null, updatedAt: new Date() })
    .where(and(eq(schema.tenantMemberships.tenantId, input.tenantId), eq(schema.tenantMemberships.userId, input.userId), isNotNull(schema.tenantMemberships.supervisorId)));
  await clearSupervisedBrokers(tx, { tenantId: input.tenantId, actorId: input.actorId, supervisorUserId: input.userId });
}
