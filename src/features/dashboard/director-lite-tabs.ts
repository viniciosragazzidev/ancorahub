import type { TenantContext } from "@/shared/auth/types";

import type { DirectorLiteTab } from "./components/director-lite/director-lite-chrome";

/**
 * Abas do painel no visual Lite, as mesmas que a tela de hoje libera para o papel: Qualidade só com a central de
 * qualidade; Funil só para diretor ou gestor com unidade (a mesma regra do /dashboard?tab=funnel).
 */
export function liteDashboardTabs(context: Pick<TenantContext, "role" | "branchId">, canReadQuality: boolean): DirectorLiteTab[] {
  const tabs: DirectorLiteTab[] = ["overview"];
  if (!canReadQuality) return tabs;
  tabs.push("quality");
  if (context.role === "director" || (context.role === "manager" && context.branchId)) tabs.push("funnel");
  return tabs;
}
