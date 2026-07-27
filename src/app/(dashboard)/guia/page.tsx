import { DashboardHeader } from "@/components/dashboard-header";
import { SystemGuide } from "@/features/guide/components/system-guide";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export default async function GuidePage() {
  const context = await getRequiredTenantContext();

  return (
    <>
      <DashboardHeader breadcrumb="Ajuda e orientação" title="Guia do sistema" />
      <SystemGuide role={context.role} />
    </>
  );
}
