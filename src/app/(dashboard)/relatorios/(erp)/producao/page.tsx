import { DashboardHeader } from "@/components/dashboard-header";
import { getProductionReport } from "@/features/erp/analytics";
import { AnalyticsNav, PeriodFilters, ProductionView, SourceNote } from "@/features/erp/components/analytics-views";
import page from "@/components/lite/page/lite-page.module.css";

export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; unit?: string }> }) {
  const report = await getProductionReport(await searchParams);
  return <><DashboardHeader breadcrumb="Inteligência" title="Produção" /><main className={page.stack}>
    <AnalyticsNav current="/relatorios/producao" />
    <p className="text-sm text-muted-foreground">Produção, implantação e recebimento são fatos separados: venda não comprova implantação, e implantação não comprova recebimento.</p>
    <PeriodFilters action="/relatorios/producao" from={report.from} to={report.to} unit={report.unit} units={report.units} />
    <ProductionView report={report} />
    <SourceNote generatedAt={report.generatedAt} metrics={report.metrics} />
  </main></>;
}
