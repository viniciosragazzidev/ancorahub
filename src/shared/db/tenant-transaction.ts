import "server-only";

import { sql } from "drizzle-orm";
import { getDatabase } from "./client";
import type { TenantContext } from "@/shared/auth/types";

type Database = ReturnType<typeof getDatabase>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Establishes the Postgres transaction-local claims consumed by RLS policies.
 * Existing reads keep using getDatabase while migrations are introduced; new
 * tenant-sensitive mutations should use this helper from the start.
 */
export async function withTenantTransaction<T>(
  context: TenantContext,
  callback: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select set_config('app.current_tenant_id', ${context.tenantId}, true)`);
    await transaction.execute(sql`select set_config('app.current_user_id', ${context.userId}, true)`);
    return callback(transaction);
  });
}
