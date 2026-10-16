import { randomUUID } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";

import { getWahaChats } from "@/features/waha-cadence/relay-client";
import { getDatabase, schema } from "@/shared/db";

/** Group chats from the relay's chat list, as `{ groupId, name }` (the id without `@g.us`). */
export function parseGroupChats(chats: unknown[]) {
  const groups: Array<{ groupId: string; name: string | null }> = [];
  const seen = new Set<string>();
  for (const chat of chats) {
    if (!chat || typeof chat !== "object") continue;
    const record = chat as Record<string, unknown>;
    const rawId =
      typeof record.id === "string"
        ? record.id
        : record.id && typeof record.id === "object"
          ? String((record.id as Record<string, unknown>)._serialized ?? "")
          : "";
    if (!rawId.endsWith("@g.us")) continue;
    const groupId = rawId.replace(/@g\.us$/, "");
    if (!groupId || seen.has(groupId)) continue;
    seen.add(groupId);
    const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : null;
    groups.push({ groupId, name });
  }
  return groups;
}

/**
 * Reads the groups a number belongs to and records them for the tenant.
 * Existing rows keep their `active` choice; only the name and listing time update.
 */
export async function syncWahaGroups(input: { wahaNumberId: string; tenantId: string }) {
  const db = getDatabase();
  const [number] = await db
    .select({ relaySessionId: schema.wahaNumbers.relaySessionId })
    .from(schema.wahaNumbers)
    .where(eq(schema.wahaNumbers.id, input.wahaNumberId))
    .limit(1);
  if (!number) throw new Error("Número WAHA não encontrado.");

  const groups = parseGroupChats(await getWahaChats({ sessionName: number.relaySessionId, limit: 500, kind: "group" }));
  const now = new Date();

  for (const group of groups) {
    await db
      .insert(schema.wahaGroupSources)
      .values({
        id: randomUUID(),
        tenantId: input.tenantId,
        wahaNumberId: input.wahaNumberId,
        groupId: group.groupId,
        groupName: group.name,
        active: false,
        lastListedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.wahaGroupSources.tenantId, schema.wahaGroupSources.wahaNumberId, schema.wahaGroupSources.groupId],
        set: { groupName: group.name, lastListedAt: now, updatedAt: now },
      });
  }

  return { groupsFound: groups.length };
}

/**
 * Turns capture on or off for one group. With `tenantId` the row must belong to
 * that tenant (the tenant screen); without it any row can change (platform admin).
 * Returns how many rows changed.
 */
export async function setGroupActive(input: { id: string; active: boolean; tenantId?: string }) {
  const rows = await getDatabase()
    .update(schema.wahaGroupSources)
    .set({ active: input.active, updatedAt: new Date() })
    .where(
      and(
        eq(schema.wahaGroupSources.id, input.id),
        ...(input.tenantId ? [eq(schema.wahaGroupSources.tenantId, input.tenantId)] : []),
      ),
    )
    .returning({ id: schema.wahaGroupSources.id });
  return rows.length;
}

export type CaptureStats = {
  /** Messages by capture status over the period. */
  byStatus: Record<string, number>;
  total: number;
  lastMessageAt: Date | null;
};

/** What the capture did for a tenant over the last `days` days. */
export async function getCaptureStats(tenantId: string, days = 7): Promise<CaptureStats> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await getDatabase()
    .select({
      status: schema.wahaGroupMessages.captureStatus,
      count: sql<number>`count(*)::int`,
      last: sql<Date | null>`max(${schema.wahaGroupMessages.createdAt})`,
    })
    .from(schema.wahaGroupMessages)
    .where(and(eq(schema.wahaGroupMessages.tenantId, tenantId), gte(schema.wahaGroupMessages.createdAt, since)))
    .groupBy(schema.wahaGroupMessages.captureStatus);

  const byStatus: Record<string, number> = {};
  let total = 0;
  let lastMessageAt: Date | null = null;
  for (const row of rows) {
    byStatus[row.status] = row.count;
    total += row.count;
    const last = row.last ? new Date(row.last) : null;
    if (last && (!lastMessageAt || last > lastMessageAt)) lastMessageAt = last;
  }
  return { byStatus, total, lastMessageAt };
}
