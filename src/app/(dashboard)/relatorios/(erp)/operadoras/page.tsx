import { DashboardHeader } from "@/components/dashboard-header";
import { getCarrierReport } from "@/features/erp/analytics";
import { AnalyticsNav, CarrierView, PeriodFilters, SourceNote } from "@/features/erp/components/analytics-views";
import page from "@/components/lite/page/lite-page.module.css";

export default async function CarriersPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; unit?: string }> }) {
  const report = await getCarrierReport(await searchParams);
  return <><DashboardHeader breadcrumb="Inteligência" title="Operadoras" /><main className={page.stack}>
    <AnalyticsNav current="/relatorios/operadoras" />
    <p className="text-sm text-muted-foreground">Vendas por operadora do plano vendido, com participação no total do período.</p>
    <PeriodFilters action="/relatorios/operadoras" from={report.from} to={report.to} unit={report.unit} units={report.units} />
    <CarrierView report={report} />
    <SourceNote generatedAt={report.generatedAt} metrics={report.metrics} />
  </main></>;
}
