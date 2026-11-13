import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getIncentiveCampaign } from "@/features/erp/incentives";
import { IncentiveCampaignActions, IncentiveCampaignDetail } from "@/features/erp/components/incentives-workspace";
import { ErpPage } from "@/features/erp/ui/erp-page";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> };

export default async function IncentiveCampaignPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await getIncentiveCampaign(id, query.page);
  const actions = <div className="flex flex-wrap items-center gap-2">
    <Button variant="ghost" render={<Link href="/campanhas-incentivo" />}>Voltar às campanhas</Button>
    <IncentiveCampaignActions data={data} />
  </div>;
  return <ErpPage pathname={`/campanhas-incentivo/${id}`} breadcrumb="Campanhas de incentivo" title={data.campaign.name} actions={actions}>
    <IncentiveCampaignDetail data={data} />
  </ErpPage>;
}
