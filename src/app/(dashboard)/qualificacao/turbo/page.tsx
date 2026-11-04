import { DashboardHeader } from "@/components/dashboard-header";
import { getTurboAdminData } from "@/features/qualification-turbo/actions";
import { TurboAdmin } from "@/features/qualification-turbo/components/turbo-admin";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { TurboAdminLite } from "@/features/qualification-turbo/components/turbo-admin-lite";
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
  // Chave do visual Lite: os mesmos templates, configurações e ações.
  if (await isDirectorLitePageOnServer(context, "/qualificacao/turbo")) {
    return (
      <>
        <DashboardHeader breadcrumb="Qualificação" title="Qualificação turbo" />
        <main className={litePage.stack}>
          <TurboAdminLite data={data} />
        </main>
      </>
    );
  }
  return (
    <>
      <DashboardHeader breadcrumb="Qualificação" title="Qualificação turbo" />
      <main className="flex flex-1 flex-col p-(--mobile-page-padding) lg:p-6">
        <TurboAdmin data={data} />
      </main>
    </>
  );
}
