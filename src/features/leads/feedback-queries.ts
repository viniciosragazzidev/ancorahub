"use server";

import { and, count, eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

/**
 * Returns the number of leads assigned to the current broker that have
 * an open `leadAssignmentAttempt` (i.e., feedback is pending/overdue).
 */
export async function getPendingFeedbackCountAction(): Promise<{ count: number }> {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") return { count: 0 };

  const db = getDatabase();
  const [result] = await db
    .select({ total: count(schema.leadAssignmentAttempts.id) })
    .from(schema.leadAssignmentAttempts)
    .where(
      and(
        eq(schema.leadAssignmentAttempts.tenantId, context.tenantId),
        eq(schema.leadAssignmentAttempts.brokerId, context.userId),
        eq(schema.leadAssignmentAttempts.status, "open"),
      ),
    )
    .limit(1);

  return { count: Number(result?.total ?? 0) };
}
