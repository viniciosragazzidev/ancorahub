import { StatCard } from "@/components/dashboard/metric-card";
import { getIncentiveCampaigns } from "@/features/erp/incentives";
import { INCENTIVE_STATUSES, INCENTIVE_STATUS_LABELS } from "@/features/erp/incentive-core";
import { IncentivesWorkspace } from "@/features/erp/components/incentives-workspace";
import { ErpHeaderActions, ErpHelp, ErpPrimaryAction, ErpSearch, ErpStats, ErpToolbar, ErpUrlFilter } from "@/features/erp/ui/erp-kit";
import { ErpPage } from "@/features/erp/ui/erp-page";

type SearchParams = { status?: string; q?: string; page?: string };

export default async function IncentiveCampaignsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const data = await getIncentiveCampaigns(await searchParams);
  const statusOptions = [{ value: "all", label: "Todas as situações" }, ...INCENTIVE_STATUSES.map((value) => ({ value, label: INCENTIVE_STATUS_LABELS[value] }))];
  const actions = <ErpHeaderActions>
    <ErpHelp title="Como funcionam as campanhas">
      <p>A campanha de incentivo tem regulamento, período, métrica e unidades. Ela não se confunde com campanhas de marketing nem com pontos da Jornada.</p>
      <p>Quem prepara o rascunho não aprova: outra pessoa autorizada aprova, e depois disso o regulamento não muda. Para alterar, cancele e crie outra.</p>
      <p>A apuração é reproduzível: os mesmos fatos com a mesma versão do regulamento geram a mesma assinatura. A premiação é só descrição e não gera pagamento.</p>
    </ErpHelp>
    {data.canManage ? <ErpPrimaryAction label="Nova campanha" /> : null}
  </ErpHeaderActions>;
  return <ErpPage pathname="/campanhas-incentivo" breadcrumb="Operação ERP" title="Incentivos" actions={actions}>
    <ErpStats>
      <StatCard label="Vigentes" value={data.summary.running.toLocaleString("pt-BR")} sublabel="aprovadas e no período" />
      <StatCard label="Aguardando aprovação" value={data.summary.awaitingApproval.toLocaleString("pt-BR")} sublabel="rascunhos" />
      <StatCard label="Aguardando apuração final" value={data.summary.awaitingFinal.toLocaleString("pt-BR")} sublabel="período encerrado" />
      <StatCard label="Encerradas" value={data.summary.closed.toLocaleString("pt-BR")} sublabel="com apuração final" />
    </ErpStats>
    <ErpToolbar>
      <ErpSearch label="Buscar campanha" placeholder="Buscar campanha pelo nome" value={data.filters.q} />
      <ErpUrlFilter label="Situação da campanha" param="status" value={data.filters.status} defaultValue="all" options={statusOptions} />
    </ErpToolbar>
    <IncentivesWorkspace key={`${data.filters.status}-${data.filters.q}-${data.filters.page}`} data={data} />
  </ErpPage>;
}
