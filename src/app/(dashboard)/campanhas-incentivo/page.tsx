import { DashboardHeader } from "@/components/dashboard-header";
import { getIncentiveCampaigns } from "@/features/erp/incentives";
import { IncentivesList, NewIncentiveCampaign } from "@/features/erp/components/incentives-workspace";
import page from "@/components/lite/page/lite-page.module.css";

export default async function IncentiveCampaignsPage() {
  const data = await getIncentiveCampaigns();
  return <><DashboardHeader breadcrumb="Inteligência" title="Campanhas de incentivo" rightSlot={data.canManage ? <NewIncentiveCampaign branches={data.branches} /> : undefined} /><main className={page.stack}>
    <p className="text-sm text-muted-foreground">Regulamento aprovado por outra pessoa, apuração reproduzível e ranking conforme a política de exposição. Não se confunde com campanhas de marketing nem com pontos da Jornada, e não gera pagamento.</p>
    <IncentivesList data={data} />
    {data.rows.length >= 100 ? <p className="text-sm text-muted-foreground">Mostrando as 100 campanhas mais recentes.</p> : null}
  </main></>;
}
