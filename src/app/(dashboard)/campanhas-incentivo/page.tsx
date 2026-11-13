import { getIncentiveCampaigns } from "@/features/erp/incentives";
import { INCENTIVE_STATUSES, INCENTIVE_STATUS_LABELS } from "@/features/erp/incentive-core";
import { IncentivesWorkspace } from "@/features/erp/components/incentives-workspace";
import { ErpNote, ErpToolbar, ErpUrlFilter } from "@/features/erp/ui/erp-kit";
import { ErpPage } from "@/features/erp/ui/erp-page";

type SearchParams = { status?: string; page?: string };

export default async function IncentiveCampaignsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const data = await getIncentiveCampaigns(await searchParams);
  const statusOptions = [{ value: "all", label: "Todas as situações" }, ...INCENTIVE_STATUSES.map((value) => ({ value, label: INCENTIVE_STATUS_LABELS[value] }))];
  return <ErpPage pathname="/campanhas-incentivo" breadcrumb="Inteligência" title="Campanhas de incentivo">
    <ErpNote>
      Não se confunde com campanhas de marketing nem com pontos da Jornada, e não gera pagamento.
    </ErpNote>
    <ErpToolbar>
      <ErpUrlFilter label="Situação da campanha" param="status" value={data.filters.status} defaultValue="all" options={statusOptions} />
    </ErpToolbar>
    <IncentivesWorkspace key={`${data.filters.status}-${data.filters.page}`} data={data} />
  </ErpPage>;
}
