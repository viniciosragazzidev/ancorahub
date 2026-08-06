import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { isUserProfileEnabled } from "@/features/user-profile/feature";
import { getUserProfileData } from "@/features/user-profile/queries";
import { PerfilTabs, type PerfilData } from "@/features/user-profile/components/perfil-tabs";
import { AccountTab } from "./account-tab";

/**
 * Aba "Minha conta" das configurações.
 *
 * Quando o recurso de perfil está habilitado (controle global do super-admin),
 * renderiza a experiência completa do antigo /perfil (visão geral, segurança,
 * sessões e registro de atividades). Caso contrário, mantém o resumo simples.
 */
export async function MinhaContaTab({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: string;
}) {
  if (!(await isUserProfileEnabled())) {
    return <AccountTab name={name} email={email} role={role} />;
  }

  const context = await getRequiredTenantContext();
  const data: PerfilData = await getUserProfileData(context);

  return <PerfilTabs data={data} />;
}
