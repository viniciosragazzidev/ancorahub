import { and, eq, isNull } from "drizzle-orm";

import type { DatabaseExecutor } from "@/shared/db";
import { schema } from "@/shared/db";

export type InvestigationLeadSnapshot = {
  id: string;
  tenantId: string;
  status: typeof schema.leads.$inferSelect.status;
  corretorId: string | null;
  branchId: string | null;
};

/** Claims a lead only while its tenant, stage, owner and unit still match the screen snapshot. */
export async function claimLeadForInvestigation(
  tx: DatabaseExecutor,
  input: { expected: InvestigationLeadSnapshot; actorId: string; now: Date },
) {
  const { expected } = input;
  const [claimed] = await tx.update(schema.leads).set({
    corretorId: input.actorId,
    status: "under_analysis",
    distributionStatus: "assigned",
    assignedAt: input.now,
    stageEnteredAt: input.now,
    firstContactAt: null,
    serviceStartedAt: null,
    serviceStartedBy: null,
  }).where(and(
    eq(schema.leads.id, expected.id),
    eq(schema.leads.tenantId, expected.tenantId),
    eq(schema.leads.status, expected.status),
    expected.corretorId === null ? isNull(schema.leads.corretorId) : eq(schema.leads.corretorId, expected.corretorId),
    expected.branchId === null ? isNull(schema.leads.branchId) : eq(schema.leads.branchId, expected.branchId),
  )).returning({ id: schema.leads.id, branchId: schema.leads.branchId });

  return claimed ?? null;
}
