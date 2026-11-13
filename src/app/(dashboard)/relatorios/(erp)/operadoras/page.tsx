import { getCarrierReport } from "@/features/erp/analytics";
import { AnalyticsSettings, CarrierView } from "@/features/erp/components/analytics-views";
import { ErpPage } from "@/features/erp/ui/erp-page";

export default async function CarriersPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; unit?: string }> }) {
  const report = await getCarrierReport(await searchParams);
  const settings = <AnalyticsSettings metrics={report.metrics} generatedAt={report.generatedAt} perspective="operadoras" />;
  return <ErpPage pathname="/relatorios/operadoras" breadcrumb="Inteligência" title="Operadoras" actions={settings}>
    <CarrierView report={report} />
  </ErpPage>;
}
