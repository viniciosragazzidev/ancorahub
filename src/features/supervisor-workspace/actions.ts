"use server";

import { randomUUID } from "node:crypto";

import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { SUPERVISOR_MAX_BROKERS } from "@/features/team/supervised-brokers";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

/**
 * P2: the supervisor adds a broker of their own unit that has no supervisor
 * yet (taking a broker from another team is the manager's call, P9).
 */
export async function addBrokerToMyTeamAction(rawBrokerId: string): Promise<{ ok: boolean; message: string }> {
  try {
    const brokerId = z.string().min(1).max(80).parse(rawBrokerId);
    const context = await getRequiredTenantContext();
    if (context.role !== "supervisor" || !context.supervisorTeamScope) return { ok: false, message: "Só o supervisor monta a própria equipe." };
    if (!context.branchId) return { ok: false, message: "Seu acesso não tem unidade. Peça ao gestor para montar a equipe." };
    const db = getDatabase();
    const memberships = schema.tenantMemberships;
    const added = await db.transaction(async (tx) => {
      // Lock the supervisor's own row: two adds at once are serialized, so the cap of 30 holds.
      const [me] = await tx.select({ id: memberships.id }).from(memberships)
        .where(and(eq(memberships.tenantId, context.tenantId), eq(memberships.userId, context.userId), eq(memberships.role, "supervisor"), eq(memberships.status, "active")))
        .for("update");
      if (!me) throw new Error("Seu acesso de supervisor não está ativo.");
      const [current] = await tx.select({ total: count() }).from(memberships)
        .where(and(eq(memberships.tenantId, context.tenantId), eq(memberships.supervisorId, context.userId), eq(memberships.status, "active")));
      if (Number(current?.total ?? 0) >= SUPERVISOR_MAX_BROKERS) throw new Error(`Sua equipe já tem ${SUPERVISOR_MAX_BROKERS} corretores.`);
      // Only a free broker of the same unit (the WHERE is the rule: concurrent adds cannot both win).
      const rows = await tx.update(memberships).set({ supervisorId: context.userId, updatedAt: new Date() })
        .where(and(
          eq(memberships.tenantId, context.tenantId),
          eq(memberships.userId, brokerId),
          eq(memberships.role, "broker"),
          eq(memberships.status, "active"),
          eq(memberships.branchId, context.branchId!),
          isNull(memberships.supervisorId),
        ))
        .returning({ id: memberships.id });
      if (!rows.length) throw new Error("Esse corretor não está mais livre na sua unidade.");
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "supervisor_team", entidadeId: context.userId, acao: `adicionou o corretor ${brokerId} à própria equipe` });
      return rows.length;
    });
    revalidatePath("/dashboard");
    revalidatePath("/equipe");
    return { ok: added > 0, message: "Pronto, o corretor entrou na sua equipe." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não consegui adicionar agora." };
  }
}
