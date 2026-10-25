/**
 * "Minha conta" no visual Lite. Mesma regra da aba atual: com o perfil habilitado pelo super admin, a experiência
 * completa do perfil (o mesmo componente, numa moldura Lite); sem ele, o resumo de nome, e-mail e perfil de acesso.
 */
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { isUserProfileEnabled } from "@/features/user-profile/feature";
import { getUserProfileData } from "@/features/user-profile/queries";
import { PerfilTabs, type PerfilData } from "@/features/user-profile/components/perfil-tabs";
import compat from "@/components/lite/page/lite-compat.module.css";

import { AccountSummaryLite } from "./account-summary-lite";

export async function AccountLite({ name, email, role }: { name: string; email: string; role: string }) {
  if (!(await isUserProfileEnabled())) {
    return <AccountSummaryLite name={name} email={email} role={role} />;
  }
  const context = await getRequiredTenantContext();
  const data: PerfilData = await getUserProfileData(context);
  return (
    <div className={compat.compat}>
      <PerfilTabs data={data} />
    </div>
  );
}
