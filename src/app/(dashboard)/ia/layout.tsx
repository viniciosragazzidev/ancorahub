import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isManagerAiAreaPathAllowed } from "@/features/manager-scope/manager-routes";
import { AuthorizationError } from "@/shared/auth/errors";
import { hasCapability } from "@/shared/auth/permissions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

/**
 * Área da IA (/ia): mesma regra de acesso das telas de qualificação (gestor de unidade fora, permissão da IA).
 * Exceção de 26/11: o gestor abre Perguntas para a direção (só os leads da unidade; a página confere quem responde).
 * O layout não roda de novo na navegação entre abas, então /ia, /ia/alertas e /ia/execucoes também barram o gestor.
 */
export default async function AiAreaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getRequiredTenantContext();
  if (context.role === "manager") {
    const pathname = (await headers()).get("x-pathname") || "";
    if (pathname !== "" && !isManagerAiAreaPathAllowed(pathname)) redirect("/access-denied");
    return children;
  }
  if (!hasCapability(context.role, "acessar_qualificacao_ia", context.jobTitle)) {
    throw new AuthorizationError("Apenas diretores, gestores e equipe de marketing têm permissão para acessar a qualificação por IA.");
  }
  return children;
}
