import { and, eq, isNull } from "drizzle-orm";

import type { DatabaseExecutor } from "@/shared/db";
import { schema } from "@/shared/db";

export type ProposalConversionClaim =
  | { kind: "claimed" }
  | { kind: "already_converted"; saleId: string }
  | { kind: "conflict" };

/** Atomically reserves one approved proposal for a single sale transaction. */
export async function claimProposalConversion(
  tx: DatabaseExecutor,
  input: { tenantId: string; proposalId: string; saleId: string; convertedAt: Date },
): Promise<ProposalConversionClaim> {
  const [claimed] = await tx
    .update(schema.proposals)
    .set({ convertedAt: input.convertedAt, convertedSaleId: input.saleId, updatedAt: input.convertedAt })
    .where(and(
      eq(schema.proposals.id, input.proposalId),
      eq(schema.proposals.tenantId, input.tenantId),
      eq(schema.proposals.status, "aprovada"),
      isNull(schema.proposals.convertedSaleId),
    ))
    .returning({ id: schema.proposals.id });

  if (claimed) return { kind: "claimed" };

  const [current] = await tx
    .select({ convertedSaleId: schema.proposals.convertedSaleId })
    .from(schema.proposals)
    .where(and(eq(schema.proposals.id, input.proposalId), eq(schema.proposals.tenantId, input.tenantId)))
    .limit(1);

  return current?.convertedSaleId
    ? { kind: "already_converted", saleId: current.convertedSaleId }
    : { kind: "conflict" };
}
