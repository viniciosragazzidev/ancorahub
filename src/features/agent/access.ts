import "server-only";

import { isOutsideManagerScope } from "@/features/manager-scope/manager-routes";
import { hasEffectiveCapability } from "@/features/custom-roles/service";
import { getSystemSetting } from "@/features/system-settings/queries";
import type { TenantContext } from "@/shared/auth/types";

import { agentAccessAllowed, agentOffSettingKey, parseAgentOffList } from "./access-rules";

export async function listAgentOffUsers(tenantId: string) {
  return parseAgentOffList(await getSystemSetting(agentOffSettingKey(tenantId)).catch(() => null));
}

/** A mesma decisão para a rota do agente, o layout (gaveta) e a sidebar (via permissões do usuário). */
export async function canUseDirectorAgent(context: Pick<TenantContext, "tenantId" | "userId" | "role" | "jobTitle" | "customRoleId">) {
  if (context.role !== "director") return false;
  const [hasCapability, off] = await Promise.all([
    hasEffectiveCapability({ tenantId: context.tenantId, role: context.role, jobTitle: context.jobTitle, customRoleId: context.customRoleId ?? null, permission: "usar_agente_ia" }),
    listAgentOffUsers(context.tenantId),
  ]);
  return agentAccessAllowed({
    role: context.role,
    outsideManagerScope: isOutsideManagerScope(context.role, context.jobTitle),
    hasCapability,
    offForUser: off.includes(context.userId),
  });
}
