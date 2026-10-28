"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag, setSystemSetting } from "@/features/system-settings/queries";

export async function updateContextualIllustrationsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = z.enum(["true", "false"]).parse(formData.get("contextualIllustrationsEnabled") ?? "false");
  const previous = await getFeatureFlag(FEATURE_FLAGS.UI_CONTEXTUAL_ILLUSTRATIONS);
  const now = new Date();
  await setSystemSetting(FEATURE_FLAGS.UI_CONTEXTUAL_ILLUSTRATIONS.key, enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(), actorUserId: admin.userId,
    action: "contextual_illustrations.settings_updated",
    targetType: "system_settings", targetId: FEATURE_FLAGS.UI_CONTEXTUAL_ILLUSTRATIONS.key,
    metadata: { enabled, previousEnabled: previous, scope: "global" }, createdAt: now,
  });
  revalidatePath("/", "layout");
}
