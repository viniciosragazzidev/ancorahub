import "server-only";

import { and, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { publishLeadInvalidation } from "@/features/leads/publish-lead-invalidation";

/**
 * Tells every broker whose wallet changed (new owner, previous owner, losing
 * bidders) and the lead's supervisors to re-read their lead views, so offers,
 * acceptances and rotations show up without a manual refresh. Call only after
 * the change is committed. Best-effort: a signal failure never fails the flow.
 */
export async function signalLeadOwnershipChange(input: {
  tenantId: string;
  leadId: string;
  brokerIds: Array<string | null | undefined>;
}): Promise<void> {
  const brokerIds = [...new Set(input.brokerIds.filter((id): id is string => Boolean(id)))];
  if (!brokerIds.length) return;
  try {
    const [lead] = await getDatabase()
      .select({ branchId: schema.leads.branchId })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)))
      .limit(1);
    await publishLeadInvalidation({
      tenantId: input.tenantId,
      actorId: brokerIds[0],
      branchIds: [lead?.branchId],
      brokerIds,
    });
  } catch {
    // The client-side reconciliation still converges when a signal is lost.
  }
}
