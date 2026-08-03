"use server";

import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export async function checkBrokerDistributedLeadsAction(): Promise<number> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "broker") return 0;
    const db = getDatabase();
    
    const rows = await db.select({ count: sql<number>`count(*)` })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          eq(schema.leads.corretorId, context.userId),
          eq(schema.leads.status, "distributed")
        )
      );
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

export async function updateBrokerAvailabilityAction(status: "available" | "paused" | "offline") {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") throw new Error("Apenas corretores podem alterar a própria disponibilidade.");
  const parsedStatus = z.enum(["available", "paused", "offline"]).safeParse(status);
  if (!parsedStatus.success) throw new Error("Disponibilidade inválida.");
  const db = getDatabase();
  
  const [membership] = await db.select({ id: schema.tenantMemberships.id })
    .from(schema.tenantMemberships).where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, context.userId))).limit(1);
  if (!membership) throw new Error("Vínculo operacional não encontrado.");
  
  await db.transaction(async (tx) => {
    await tx.update(schema.tenantMemberships)
      .set({ availabilityStatus: parsedStatus.data, updatedAt: new Date() })
      .where(and(eq(schema.tenantMemberships.id, membership.id), eq(schema.tenantMemberships.tenantId, context.tenantId)));
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "broker_availability",
      entidadeId: membership.id,
      acao: `atualizou_${parsedStatus.data}`,
    });
  });
    
  revalidatePath("/dashboard");
  revalidatePath("/corretor/resumo");
}
