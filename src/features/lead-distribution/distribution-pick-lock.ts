import { sql } from "drizzle-orm";
import type { getDatabase } from "@/shared/db";

type DatabaseLike = ReturnType<typeof getDatabase>;

const PICK_LOCK_ATTEMPTS = 10;
const PICK_LOCK_RETRY_SECONDS = 0.2;

async function isLockAcquired(tx: { execute: DatabaseLike["execute"] }, tenantId: string) {
  const rows = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtext(${tenantId}), hashtext('distribution-pick')) as locked`);
  const first = (Array.isArray(rows) ? rows[0] : (rows as { rows?: unknown[] }).rows?.[0]) as { locked?: boolean } | undefined;
  return Boolean(first?.locked);
}

/** One non-blocking attempt for a manual queue; a busy choice falls back to automatic. */
export function tryDistributionPickLockOnce(tx: { execute: DatabaseLike["execute"] }, tenantId: string) {
  return isLockAcquired(tx, tenantId);
}

/** DEC-154: bounded wait for the per-tenant pick lock (released at commit). */
export async function tryDistributionPickLock(tx: { execute: DatabaseLike["execute"] }, tenantId: string) {
  for (let attempt = 0; attempt < PICK_LOCK_ATTEMPTS; attempt += 1) {
    if (await isLockAcquired(tx, tenantId)) return true;
    if (attempt < PICK_LOCK_ATTEMPTS - 1) await tx.execute(sql`select pg_sleep(${PICK_LOCK_RETRY_SECONDS})`);
  }
  return false;
}
