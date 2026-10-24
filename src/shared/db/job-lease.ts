import "server-only";

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";

import { getDatabase } from "./client";

/** Keys of job leases in system_settings; the settings readers skip them. */
export const JOB_LEASE_PREFIX = "lease:";

/**
 * One run at a time without holding a DB socket (Fase 1 de performance, 24/10). The jobs used
 * `pg_try_advisory_xact_lock` inside a transaction left open for the whole run (up to 100 s):
 * one socket sat "idle in transaction" while the work queued for the others, and every user's
 * page waited behind it. A lease is one short write: a row in system_settings that says
 * "busy until <time>". It expires by itself if the process dies mid-run.
 */
export async function withJobLease<T>(name: string, ttlMs: number, work: () => Promise<T>): Promise<{ acquired: false } | { acquired: true; value: T }> {
  const db = getDatabase();
  const key = `${JOB_LEASE_PREFIX}${name}`;
  const now = new Date();
  // The value is "<expires ISO>|<owner>": ISO strings compare in time order, and the owner
  // makes sure a run only releases its own lease.
  const value = `${new Date(now.getTime() + ttlMs).toISOString()}|${randomUUID()}`;
  const rows = await db.execute(sql`
    insert into system_settings (key, value, updated_at)
    values (${key}, ${value}, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()
    where system_settings.value < ${now.toISOString()}
    returning key
  `);
  const list = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows ?? [];
  if (!list.length) return { acquired: false };
  try {
    return { acquired: true, value: await work() };
  } finally {
    await db.execute(sql`delete from system_settings where key = ${key} and value = ${value}`).catch(() => undefined);
  }
}
