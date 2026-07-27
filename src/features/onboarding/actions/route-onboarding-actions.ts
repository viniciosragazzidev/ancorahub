"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { completeRouteOnboarding, getRouteOnboardingState } from "../route-onboarding-service";

const routeKeySchema = z.string().trim().min(1).max(80);

export async function getRouteOnboardingStateAction(routeKey: string) {
  return getRouteOnboardingState(routeKeySchema.parse(routeKey));
}

export async function completeRouteOnboardingAction(routeKey: string) {
  await completeRouteOnboarding(routeKeySchema.parse(routeKey));
}

export async function setRouteOnboardingGlobalAction(formData: FormData) {
  const { getRequiredPlatformAdmin } = await import("@/shared/auth/platform-admin");
  const { getDatabase, schema } = await import("@/shared/db");
  const { setSystemSetting } = await import("@/features/system-settings/queries");
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("enabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting("feature_route_onboarding_enabled", enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(), actorUserId: admin.userId, action: "route_onboarding.global_updated",
    targetType: "system_settings", targetId: "route_onboarding", metadata: { enabled }, createdAt: now,
  });
  revalidatePath("/super-admin/settings");
}
