import { and, eq, gt } from "drizzle-orm";

import type { DatabaseExecutor } from "@/shared/db";
import { schema } from "@/shared/db";

/** Atomically consumes a still-pending, unexpired invitation before any activation writes. */
export async function claimPendingInvitation(
  tx: DatabaseExecutor,
  input: { id: string; tenantId: string; email: string; now: Date },
) {
  const [claimed] = await tx.update(schema.brokerInvitations).set({
    email: input.email,
    status: "ACCEPTED",
    acceptedAt: input.now,
  }).where(and(
    eq(schema.brokerInvitations.id, input.id),
    eq(schema.brokerInvitations.tenantId, input.tenantId),
    eq(schema.brokerInvitations.status, "PENDING"),
    gt(schema.brokerInvitations.expiresAt, input.now),
  )).returning({ id: schema.brokerInvitations.id });
  return claimed ?? null;
}
