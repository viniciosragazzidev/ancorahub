import { DashboardHeader } from "@/components/dashboard-header";
import { getTurboAdminData } from "@/features/qualification-turbo/actions";
import { TurboAdmin } from "@/features/qualification-turbo/components/turbo-admin";
import { AuthorizationError } from "@/shared/auth/errors";
import { hasCapability } from "@/shared/auth/permissions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export default async function QualificacaoTurboPage() {
  const context = await getRequiredTenantContext();
  if (!hasCapability(context.role, "acessar_qualificacao_ia", context.jobTitle)) {
    throw new AuthorizationError("Apenas diretores, gestores e equipe de marketing têm permissão para acessar a qualificação por IA.");
  }
  const data = await getTurboAdminData();
  return (
    <>
      <DashboardHeader breadcrumb="Qualificação" title="Qualificação turbo" />
      <main className="flex flex-1 flex-col p-(--mobile-page-padding) lg:p-6">
        <TurboAdmin data={data} />
      </main>
    </>
  );
}
