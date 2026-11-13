import { DashboardHeader } from "@/components/dashboard-header";
import { getDailyReport } from "@/features/erp/analytics";
import { AnalyticsNav, DailyView, MonthFilter, SourceNote } from "@/features/erp/components/analytics-views";
import page from "@/components/lite/page/lite-page.module.css";

export default async function DailyPage({ searchParams }: { searchParams: Promise<{ month?: string; unit?: string }> }) {
  const report = await getDailyReport(await searchParams);
  return <><DashboardHeader breadcrumb="Inteligência" title="Análise diária" /><main className={page.stack}>
    <AnalyticsNav current="/relatorios/diario" />
    <p className="text-sm text-muted-foreground">Dia a dia do mês: vendas pela data da venda e leads pela data de entrada.</p>
    <MonthFilter action="/relatorios/diario" month={report.month} unit={report.unit} units={report.units} />
    <DailyView report={report} />
    <SourceNote generatedAt={report.generatedAt} metrics={report.metrics} />
  </main></>;
}
