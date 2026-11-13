import { DashboardHeader } from "@/components/dashboard-header";
import { getScopedGoals } from "@/features/erp/analytics";
import { GoalsView } from "@/features/erp/components/analytics-views";
import page from "@/components/lite/page/lite-page.module.css";

export default async function GoalsPage() {
  const goals = await getScopedGoals();
  return <><DashboardHeader breadcrumb="Inteligência" title="Metas" /><main className={page.stack}>
    <GoalsView goals={goals} />
  </main></>;
}
