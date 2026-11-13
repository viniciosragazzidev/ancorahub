import { getDailyReport } from "@/features/erp/analytics";
import { AnalyticsSettings, DailyView } from "@/features/erp/components/analytics-views";
import { ErpPage } from "@/features/erp/ui/erp-page";

export default async function DailyPage({ searchParams }: { searchParams: Promise<{ month?: string; unit?: string }> }) {
  const report = await getDailyReport(await searchParams);
  const settings = <AnalyticsSettings metrics={report.metrics} generatedAt={report.generatedAt} />;
  return <ErpPage pathname="/relatorios/diario" breadcrumb="Inteligência" title="Análise diária" actions={settings}>
    <DailyView report={report} />
  </ErpPage>;
}
