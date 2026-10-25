import "server-only";

import { getSystemSetting } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import type { TenantContext } from "@/shared/auth/types";

export function directorLiteStyleSettingKey(tenantId: string) {
  return `${FEATURE_FLAGS.DIRECTOR_LITE_STYLE.key}_${tenantId}`;
}

/** Tenant IDs must come from the authenticated context or a validated admin target. */
export async function isDirectorLiteStyleEnabled(tenantId: string) {
  const value = await getSystemSetting(directorLiteStyleSettingKey(tenantId)).catch(() => null);
  return value === "true";
}

/**
 * Regra pura do visual Lite das telas internas (o nome "director" ficou por histórico: desde 25/10 vale para todo o
 * modo normal). Liga só com a chave da empresa ligada E o usuário fora de um Lite próprio (corretor, supervisor ou
 * gestor no modo LIGHT). `ownLiteAudience` é o resultado de getLiteAudience (null = modo normal).
 */
export function directorLiteAppliesTo(keyEnabled: boolean, ownLiteAudience: "broker" | "supervisor" | "manager" | null) {
  return keyEnabled && ownLiteAudience === null;
}

/**
 * O visual Lite das telas internas vale para este usuário? Chave por empresa (feature_director_lite_style) ligada e
 * usuário no modo normal: diretor, marketing, financeiro, cargo personalizado, gestor fora do Lite de gestor e
 * qualquer outro papel que não esteja no Lite próprio. No "ver como" o contexto já é o do usuário visto, então a
 * regra segue o papel visto. A chave é lida primeiro: desligada, nada mais é consultado e o resultado é falso.
 * Isto decide só o VISUAL; permissões continuam nas regras de cada tela.
 */
export async function shouldUseDirectorLiteStyle(context: TenantContext) {
  if (!(await isDirectorLiteStyleEnabled(context.tenantId))) return false;
  const { getLiteAudience } = await import("@/features/broker-workspace/lite-audience");
  const audience = await getLiteAudience(context).catch(() => "broker" as const);
  return directorLiteAppliesTo(true, audience);
}

/**
 * Regra de página do Lite no servidor (a mesma do useDirectorLitePage no cliente): a regra acima e a rota fora do
 * opt-out. As páginas que trocam para o Lite no servidor usam só esta função.
 */
export async function isDirectorLitePageOnServer(context: TenantContext, pathname: string) {
  const { isDirectorLiteRouteOptedOut } = await import("@/components/arc/director-lite-routes");
  if (isDirectorLiteRouteOptedOut(pathname)) return false;
  return shouldUseDirectorLiteStyle(context).catch(() => false);
}
