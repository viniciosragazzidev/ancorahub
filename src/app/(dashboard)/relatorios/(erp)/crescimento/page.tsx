import { DashboardHeader } from "@/components/dashboard-header";
import { getGrowthReport } from "@/features/erp/analytics";
import { AnalyticsNav, GrowthView, UnitFilter, SourceNote } from "@/features/erp/components/analytics-views";
import page from "@/components/lite/page/lite-page.module.css";

export default async function GrowthPage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  const report = await getGrowthReport(await searchParams);
  return <><DashboardHeader breadcrumb="Inteligência" title="Crescimento" /><main className={page.stack}>
    <AnalyticsNav current="/relatorios/crescimento" />
    <p className="text-sm text-muted-foreground">Últimos 12 meses comparados ao mesmo mês do ano anterior.</p>
    <UnitFilter action="/relatorios/crescimento" unit={report.unit} units={report.units} />
    <GrowthView report={report} />
    <SourceNote generatedAt={report.generatedAt} metrics={report.metrics} />
  </main></>;
}
