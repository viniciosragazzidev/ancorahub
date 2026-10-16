"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getDatabase, schema } from "@/shared/db";
import { getWahaChats } from "@/features/waha-cadence/relay-client";

const PAGE_PATH = "/super-admin/waha-grupos";

const listInputSchema = z.object({
  wahaNumberId: z.string().min(1).max(200),
  tenantId: z.string().min(1).max(200),
});

const toggleInputSchema = z.object({
  id: z.string().min(1).max(200),
  active: z.boolean(),
});

/** Chat entries from the relay that are group chats, as `{ groupId, name }`. */
function groupChats(chats: unknown[]) {
  const groups: Array<{ groupId: string; name: string | null }> = [];
  for (const chat of chats) {
    if (!chat || typeof chat !== "object") continue;
    const record = chat as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : typeof record.id === "object" && record.id !== null
      ? String((record.id as Record<string, unknown>)._serialized ?? "")
      : "";
    if (!id.endsWith("@g.us")) continue;
    const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : null;
    groups.push({ groupId: id.replace(/@g\.us$/, ""), name });
  }
  return groups;
}

/**
 * Reads the groups this number belongs to and records them for the tenant.
 * Existing rows keep their `active` choice; only the name and listing time update.
 */
export async function listWahaGroupsAction(input: { wahaNumberId: string; tenantId: string }) {
  const admin = await getRequiredPlatformAdmin();
  const { wahaNumberId, tenantId } = listInputSchema.parse(input);
  const db = getDatabase();

  const [number] = await db
    .select({ relaySessionId: schema.wahaNumbers.relaySessionId })
    .from(schema.wahaNumbers)
    .where(eq(schema.wahaNumbers.id, wahaNumberId))
    .limit(1);
  if (!number) throw new Error("Número WAHA não encontrado.");

  const groups = groupChats(await getWahaChats({ sessionName: number.relaySessionId, limit: 500 }));
  const now = new Date();

  for (const group of groups) {
    await db
      .insert(schema.wahaGroupSources)
      .values({
        id: randomUUID(),
        tenantId,
        wahaNumberId,
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

  await db.insert(schema.platformAuditLogs).values({
    id: randomUUID(),
    actorUserId: admin.userId,
    action: "waha_group_sources.listed",
    targetType: "waha_number",
    targetId: wahaNumberId,
    metadata: { tenantId, groupsFound: groups.length },
    createdAt: now,
  });

  revalidatePath(PAGE_PATH);
  return { groupsFound: groups.length };
}

/** Turns capture on or off for one group. Only active groups leave the chat. */
export async function setWahaGroupActiveAction(input: { id: string; active: boolean }) {
  const admin = await getRequiredPlatformAdmin();
  const { id, active } = toggleInputSchema.parse(input);
  const db = getDatabase();
  const now = new Date();

  await db
    .update(schema.wahaGroupSources)
    .set({ active, updatedAt: now })
    .where(eq(schema.wahaGroupSources.id, id));

  await db.insert(schema.platformAuditLogs).values({
    id: randomUUID(),
    actorUserId: admin.userId,
    action: "waha_group_sources.active_changed",
    targetType: "waha_group_source",
    targetId: id,
    metadata: { active },
    createdAt: now,
  });

  revalidatePath(PAGE_PATH);
}
