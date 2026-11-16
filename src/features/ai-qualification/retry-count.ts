import { and, eq, lt, sql } from "drizzle-orm";

import type { DatabaseExecutor } from "@/shared/db";
import { schema } from "@/shared/db";

/** Atomically increments a still-processing qualification retry below the tenant's configured limit. */
export async function incrementAiQualificationRetry(
  tx: DatabaseExecutor,
  input: { id: string; tenantId: string; maxRetries: number; now: Date },
) {
  const [updated] = await tx.update(schema.aiQualificationSessions).set({
    status: "waiting_customer",
    retryCount: sql`${schema.aiQualificationSessions.retryCount} + 1`,
    updatedAt: input.now,
  }).where(and(
    eq(schema.aiQualificationSessions.id, input.id),
    eq(schema.aiQualificationSessions.tenantId, input.tenantId),
    eq(schema.aiQualificationSessions.status, "processing"),
    lt(schema.aiQualificationSessions.retryCount, input.maxRetries),
  )).returning({ retryCount: schema.aiQualificationSessions.retryCount });
  return updated ?? null;
}
