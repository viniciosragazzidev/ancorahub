import { notFound } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { loadPlantaoReportPageData } from "@/features/reports/plantao-report";
import { PlantaoReportSettings } from "./plantao-report-settings";
import litePage from "@/components/lite/page/lite-page.module.css";

export const dynamic = "force-dynamic";

export default async function PlantaoReportSettingsPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") notFound();
  const data = await loadPlantaoReportPageData(context.tenantId);
  return <>
    <DashboardHeader breadcrumb="Configurações / Relatórios" title="Resultado do plantão" />
    <main className={litePage.stack}>
      <PlantaoReportSettings data={data} />
    </main>
  </>;
}
