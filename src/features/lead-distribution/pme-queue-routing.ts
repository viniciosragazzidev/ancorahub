import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import { pickPmeQueue, type QueueCandidate } from "./pme-queue-matching";

/** A fila PME ativa para onde vai um lead empresa que está nesta fila PF/Premium; null se não se aplica. */
export async function resolvePmeQueueFor(tenantId: string, queueId: string | null | undefined): Promise<QueueCandidate | null> {
  if (!queueId) return null;
  const db = getDatabase();
  const [source] = await db.select({ id: schema.leadQueues.id, name: schema.leadQueues.name, branchId: schema.leadQueues.branchId })
    .from(schema.leadQueues)
    .where(and(eq(schema.leadQueues.tenantId, tenantId), eq(schema.leadQueues.id, queueId)))
    .limit(1);
  if (!source) return null;
  const candidates = await db.select({ id: schema.leadQueues.id, name: schema.leadQueues.name, branchId: schema.leadQueues.branchId })
    .from(schema.leadQueues)
    .where(and(eq(schema.leadQueues.tenantId, tenantId), eq(schema.leadQueues.status, "active")))
    .orderBy(asc(schema.leadQueues.createdAt));
  return pickPmeQueue(source, candidates);
}
