"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
  const db = getDatabase();
  
  const [membership] = await db.select({ id: schema.tenantMemberships.id })
    .from(schema.tenantMemberships).where(eq(schema.tenantMemberships.userId, context.userId)).limit(1);
  if (!membership) throw new Error("Vínculo operacional não encontrado.");
  
  await db.update(schema.tenantMemberships)
    .set({ availabilityStatus: status, updatedAt: new Date() })
    .where(eq(schema.tenantMemberships.id, membership.id));
    
  revalidatePath("/dashboard");
  revalidatePath("/corretor/resumo");
}
