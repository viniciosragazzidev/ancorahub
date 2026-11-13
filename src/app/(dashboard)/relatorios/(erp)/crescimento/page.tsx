import { getGrowthReport } from "@/features/erp/analytics";
import { AnalyticsSettings, GrowthView } from "@/features/erp/components/analytics-views";
import { ErpPage } from "@/features/erp/ui/erp-page";

export default async function GrowthPage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  const report = await getGrowthReport(await searchParams);
  const settings = <AnalyticsSettings metrics={report.metrics} generatedAt={report.generatedAt} />;
  return <ErpPage pathname="/relatorios/crescimento" breadcrumb="Inteligência" title="Crescimento" actions={settings}>
    <GrowthView report={report} />
  </ErpPage>;
}
