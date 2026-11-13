import { getCommissionOverview } from "@/features/erp/commissions";
import { CommissionsList } from "@/features/erp/components/commission-list";
import { ErpPage } from "@/features/erp/ui/erp-page";

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ competence?: string; page?: string }> }) {
  const raw = await searchParams;
  const data = await getCommissionOverview({ competence: raw.competence || undefined, page: raw.page });
  return <ErpPage pathname="/financeiro/comissoes" breadcrumb="Financeiro" title={data.agency ? "Comissões" : "Minhas comissões"}>
    <CommissionsList data={data} />
  </ErpPage>;
}
