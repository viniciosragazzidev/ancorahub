import { and, eq } from "drizzle-orm";

import type { DatabaseExecutor } from "@/shared/db";
import { schema } from "@/shared/db";

/** Serializes every path that can create an active sale for the same tenant lead. */
export async function lockLeadAndFindActiveSale(tx: DatabaseExecutor, input: { tenantId: string; leadId: string }) {
  const [lead] = await tx
    .select({
      status: schema.leads.status,
      stageEnteredAt: schema.leads.stageEnteredAt,
      qualificationDetails: schema.leads.qualificationDetails,
      planId: schema.leads.planId,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)))
    .limit(1)
    .for("update");

  if (!lead) return { lead: null, activeSaleId: null };

  const [activeSale] = await tx
    .select({ id: schema.sales.id })
    .from(schema.sales)
    .where(and(
      eq(schema.sales.leadId, input.leadId),
      eq(schema.sales.tenantId, input.tenantId),
      eq(schema.sales.status, "active"),
    ))
    .limit(1);

  return { lead, activeSaleId: activeSale?.id ?? null };
}
