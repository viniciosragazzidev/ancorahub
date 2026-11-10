import "server-only";

import type { TenantContext } from "@/shared/auth/types";

import { getExperienceMode } from "./experience-mode";

/** The supervisor Lite exists for this user (role supervisor, team scope and the Lite flag on). */
export async function isSupervisorLiteAvailable(context: TenantContext) {
  if (context.role !== "supervisor" || !context.supervisorTeamScope) return false;
  const { FEATURE_FLAGS, getFeatureFlag } = await import("@/features/system-settings/queries");
  return (await getFeatureFlag(FEATURE_FLAGS.SUPERVISOR_LITE).catch(() => "false")) === "true";
}

/**
 * Lite do gestor: desligado desde 10/11 (o gestor voltou para a versão antiga, só com a gestão da unidade; ver
 * src/features/manager-scope/manager-routes.ts). A chave feature_manager_lite_enabled deixou de valer; as telas Lite
 * do gestor ficam no código para uma volta futura.
 */
export async function isManagerLiteAvailable(_context: TenantContext): Promise<boolean> {
  return false;
}

export async function getLiteAudience(context: TenantContext): Promise<"broker" | "supervisor" | "manager" | null> {
  if ((await getExperienceMode(context)) !== "LIGHT") return null;
  if (context.role === "broker") return "broker";
  if (await isManagerLiteAvailable(context)) return "manager";
  if (await isSupervisorLiteAvailable(context)) return "supervisor";
  return null;
}

