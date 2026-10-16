"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { invalidateSystemSettingsCache, setSystemSetting } from "@/features/system-settings/queries";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

import { setGroupActive, syncWahaGroups } from "./groups-service";

const PAGE_PATH = "/super-admin/waha-grupos";

const listInputSchema = z.object({
  wahaNumberId: z.string().min(1).max(200),
  tenantId: z.string().min(1).max(200),
});

const toggleInputSchema = z.object({
  id: z.string().min(1).max(200),
  active: z.boolean(),
});

const captureSettingsSchema = z.object({
  enabled: z.enum(["true", "false"]),
  ttlDays: z.coerce.number().int().min(0).max(365),
});

/** Platform switch for reading operator groups, and how long a table without an end date stays valid. */
export async function updateGroupCaptureSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const values = captureSettingsSchema.parse({
    enabled: formData.get("enabled"),
    ttlDays: formData.get("ttlDays"),
  });
  const now = new Date();

  await Promise.all([
    setSystemSetting(FEATURE_FLAGS.WAHA_GROUP_CAPTURE.key, values.enabled, now),
    setSystemSetting(FEATURE_FLAGS.OPERATOR_MATERIAL_TTL_DAYS.key, String(values.ttlDays), now),
  ]);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: randomUUID(),
    actorUserId: admin.userId,
    action: "waha_group_capture.settings_updated",
    targetType: "system_settings",
    targetId: FEATURE_FLAGS.WAHA_GROUP_CAPTURE.key,
    metadata: values,
    createdAt: now,
  });
  invalidateSystemSettingsCache();
  revalidatePath(PAGE_PATH);
  revalidatePath("/integrations/whatsapp");
}

/** Reads the groups this number belongs to and records them for the tenant (platform admin). */
export async function listWahaGroupsAction(input: { wahaNumberId: string; tenantId: string }) {
  const admin = await getRequiredPlatformAdmin();
  const { wahaNumberId, tenantId } = listInputSchema.parse(input);

  const { groupsFound } = await syncWahaGroups({ wahaNumberId, tenantId });

  await getDatabase().insert(schema.platformAuditLogs).values({
    id: randomUUID(),
    actorUserId: admin.userId,
    action: "waha_group_sources.listed",
    targetType: "waha_number",
    targetId: wahaNumberId,
    metadata: { tenantId, groupsFound },
    createdAt: new Date(),
  });

  revalidatePath(PAGE_PATH);
  return { groupsFound };
}

/** Turns capture on or off for one group. Only active groups leave the chat. */
export async function setWahaGroupActiveAction(input: { id: string; active: boolean }) {
  const admin = await getRequiredPlatformAdmin();
  const { id, active } = toggleInputSchema.parse(input);

  await setGroupActive({ id, active });

  await getDatabase().insert(schema.platformAuditLogs).values({
    id: randomUUID(),
    actorUserId: admin.userId,
    action: "waha_group_sources.active_changed",
    targetType: "waha_group_source",
    targetId: id,
    metadata: { active },
    createdAt: new Date(),
  });

  revalidatePath(PAGE_PATH);
}
