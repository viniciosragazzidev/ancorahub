import "server-only";

import type { TenantContext } from "@/shared/auth/types";

import { getExperienceMode } from "./experience-mode";

/** The supervisor Lite exists for this user (role supervisor, team scope and the Lite flag on). */
export async function isSupervisorLiteAvailable(context: TenantContext) {
  if (context.role !== "supervisor" || !context.supervisorTeamScope) return false;
  const { FEATURE_FLAGS, getFeatureFlag } = await import("@/features/system-settings/queries");
  return (await getFeatureFlag(FEATURE_FLAGS.SUPERVISOR_LITE).catch(() => "false")) === "true";
}

/** Lite screens apply to this user: a broker in LIGHT, or a supervisor with the supervisor Lite in LIGHT. */
export async function isManagerLiteAvailable(context: TenantContext) {
  if (context.role !== "manager") return false;
  const { FEATURE_FLAGS, getFeatureFlag } = await import("@/features/system-settings/queries");
  return (await getFeatureFlag(FEATURE_FLAGS.MANAGER_LITE).catch(() => "false")) === "true";
}

export async function getLiteAudience(context: TenantContext): Promise<"broker" | "supervisor" | "manager" | null> {
  if ((await getExperienceMode(context)) !== "LIGHT") return null;
  if (context.role === "broker") return "broker";
  if (await isManagerLiteAvailable(context)) return "manager";
  if (await isSupervisorLiteAvailable(context)) return "supervisor";
  return null;
}

