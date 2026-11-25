import { redirect } from "next/navigation";

import { AuthorizationError } from "@/shared/auth/errors";
import { hasCapability } from "@/shared/auth/permissions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

/** Área da IA (/ia): mesma regra de acesso das telas de qualificação (gestor de unidade fora, permissão da IA). */
export default async function AiAreaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getRequiredTenantContext();
  if (context.role === "manager") redirect("/access-denied");
  if (!hasCapability(context.role, "acessar_qualificacao_ia", context.jobTitle)) {
    throw new AuthorizationError("Apenas diretores, gestores e equipe de marketing têm permissão para acessar a qualificação por IA.");
  }
  return children;
}
