import { getProductionReport } from "@/features/erp/analytics";
import { AnalyticsSettings, ProductionView } from "@/features/erp/components/analytics-views";
import { ErpPage } from "@/features/erp/ui/erp-page";

export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; unit?: string }> }) {
  const report = await getProductionReport(await searchParams);
  const links = report.drillHref ? [{ id: "vendas", label: "Abrir lista de vendas", href: report.drillHref }] : [];
  const settings = <AnalyticsSettings metrics={report.metrics} generatedAt={report.generatedAt} links={links} perspective="producao" />;
  return <ErpPage pathname="/relatorios/producao" breadcrumb="Inteligência" title="Produção" actions={settings}>
    <ProductionView report={report} />
  </ErpPage>;
}
