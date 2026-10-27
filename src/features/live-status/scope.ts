import type { SQL } from "drizzle-orm";

import { buildNocLeadScope } from "@/features/noc/role-scope";
import { hasPermission } from "@/shared/auth/permissions";
import type { TenantContext } from "@/shared/auth/types";

import type { LiveRole, LiveScope } from "./types";

const ROLES: readonly LiveRole[] = ["director", "manager", "supervisor", "broker"];

/**
 * O escopo do status vivo sai da sessão confiável. Marketing (gestor sem unidade) e gestor sem unidade não têm
 * operação para ver: sem escopo, sem faixa. Nada do cliente entra aqui.
 */
export function resolveLiveScope(context: TenantContext): LiveScope | null {
  const role = context.role as LiveRole;
  if (!ROLES.includes(role)) return null;
  if (context.jobTitle === "marketing") return null;
  if (role === "manager" && !context.branchId) return null;
  const key = role === "director"
    ? `${context.tenantId}:all`
    : role === "manager"
      ? `${context.tenantId}:branch:${context.branchId}`
      : `${context.tenantId}:${role}:${context.userId}`;
  return {
    tenantId: context.tenantId,
    role,
    branchId: role === "manager" ? context.branchId : null,
    userId: context.userId,
    key,
    canOpenQualification: hasPermission(context.role, "acessar_qualificacao_ia"),
  };
}

/** O mesmo recorte de leads das telas (NOC): empresa, unidade, equipe do supervisor ou o próprio corretor. */
export function liveLeadScope(scope: LiveScope): SQL {
  return buildNocLeadScope({ tenantId: scope.tenantId, userId: scope.userId, role: scope.role, branchId: scope.branchId, jobTitle: scope.role });
}
