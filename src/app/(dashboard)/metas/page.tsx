import { getScopedGoals } from "@/features/erp/analytics";
import { AnalyticsSettings, GoalsView } from "@/features/erp/components/analytics-views";
import { ErpPage } from "@/features/erp/ui/erp-page";

export default async function GoalsPage() {
  const goals = await getScopedGoals();
  const links = goals.manageHref ? [{ id: "gestao", label: "Definir metas em Gestão", href: goals.manageHref }] : [];
  const settings = links.length ? <AnalyticsSettings metrics={[]} generatedAt={goals.generatedAt} links={links} /> : null;
  return <ErpPage pathname="/metas" breadcrumb="Inteligência" title="Metas" actions={settings}>
    <GoalsView goals={goals} />
  </ErpPage>;
}
