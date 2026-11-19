import { and, eq, isNull } from "drizzle-orm";

import type { DatabaseExecutor } from "@/shared/db";
import { schema } from "@/shared/db";
import { lockLeadAndFindActiveSale } from "@/features/leads/lead-sale-lock";

export type ProposalConversionClaim =
  | { kind: "claimed" }
  | { kind: "already_converted"; saleId: string }
  | { kind: "sale_exists"; saleId: string }
  | { kind: "lead_not_found" }
  | { kind: "conflict" };

/** Locks the lead sale slot and validates the proposal before sale effects are written. */
export async function claimProposalConversion(
  tx: DatabaseExecutor,
  input: { tenantId: string; leadId: string; proposalId: string; convertedAt: Date },
): Promise<ProposalConversionClaim> {
  const slot = await lockLeadAndFindActiveSale(tx, { tenantId: input.tenantId, leadId: input.leadId });
  if (!slot.lead) return { kind: "lead_not_found" };
  const [current] = await tx
    .select({ convertedSaleId: schema.proposals.convertedSaleId, status: schema.proposals.status })
    .from(schema.proposals)
    .where(and(
      eq(schema.proposals.id, input.proposalId),
      eq(schema.proposals.tenantId, input.tenantId),
      eq(schema.proposals.leadId, input.leadId),
    ))
    .limit(1);

  if (current?.convertedSaleId) return { kind: "already_converted", saleId: current.convertedSaleId };
  if (!current || current.status !== "aprovada") return { kind: "conflict" };
  if (slot.activeSaleId) return { kind: "sale_exists", saleId: slot.activeSaleId };
  return { kind: "claimed" };
}

/** converted_sale_id has an immediate FK, so link it only after inserting the sale. */
export async function completeProposalConversion(
  tx: DatabaseExecutor,
  input: { tenantId: string; leadId: string; proposalId: string; saleId: string; convertedAt: Date },
) {
  const [updated] = await tx
    .update(schema.proposals)
    .set({ convertedAt: input.convertedAt, convertedSaleId: input.saleId, updatedAt: input.convertedAt })
    .where(and(
      eq(schema.proposals.id, input.proposalId),
      eq(schema.proposals.tenantId, input.tenantId),
      eq(schema.proposals.leadId, input.leadId),
      eq(schema.proposals.status, "aprovada"),
      isNull(schema.proposals.convertedSaleId),
    ))
    .returning({ id: schema.proposals.id });

  return Boolean(updated);
}
