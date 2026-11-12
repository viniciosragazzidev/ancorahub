import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { getIncentiveCampaign } from "@/features/erp/incentives";
import { IncentiveCampaignDetail } from "@/features/erp/components/incentives-workspace";
import page from "@/components/lite/page/lite-page.module.css";

export default async function IncentiveCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getIncentiveCampaign(id);
  return <><DashboardHeader breadcrumb="Campanhas de incentivo" title={data.campaign.name} /><main className={page.stack}>
    <Link href="/campanhas-incentivo" className={page.cellLink}>Voltar às campanhas</Link>
    <IncentiveCampaignDetail data={data} />
  </main></>;
}
