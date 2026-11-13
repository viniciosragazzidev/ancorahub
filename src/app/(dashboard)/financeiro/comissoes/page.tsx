import { StatCard } from "@/components/dashboard/metric-card";
import { getCommissionOverview } from "@/features/erp/commissions";
import { formatCents } from "@/features/erp/contracts";
import { CommissionsList } from "@/features/erp/components/commission-list";
import { ErpPage } from "@/features/erp/ui/erp-page";
import { ErpHeaderActions, ErpHelp, ErpMonthFilter, ErpSearch, ErpStats, ErpToolbar } from "@/features/erp/ui/erp-kit";

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ competence?: string; q?: string; page?: string }> }) {
  const raw = await searchParams;
  const data = await getCommissionOverview({ competence: raw.competence || undefined, q: raw.q, page: raw.page });
  const { summary } = data;
  const actions = <ErpHeaderActions>
    <ErpHelp title="Como funciona: Comissões">
      <p>Previsto vem do cronograma da venda. Conferido é o valor aprovado com evidência no ERP. Pago ao corretor é a soma das liquidações e compensações confirmadas.</p>
      <p>São três fatos diferentes: um não comprova o outro. Uma parcela sem conferência não tem valor pago registrado.</p>
      <p>Para trazer as parcelas pendentes de uma venda ao ERP, abra a parcela e use “Conferir no ERP”.</p>
    </ErpHelp>
  </ErpHeaderActions>;
  return <ErpPage pathname="/financeiro/comissoes" breadcrumb="Financeiro" title={data.agency ? "Comissões" : "Minhas comissões"} actions={actions}>
    <ErpStats>
      <StatCard label="Parcelas" value={summary.installments.toLocaleString("pt-BR")} sublabel="no filtro" />
      <StatCard label="Previsto" value={formatCents(summary.expectedCents)} sublabel="pelo cronograma das vendas" />
      <StatCard label="Conferidas no ERP" value={summary.conferred.toLocaleString("pt-BR")} sublabel="com lançamento" />
      {data.agency ? <StatCard label="Sem conferência" value={summary.pendingLegacy.toLocaleString("pt-BR")} sublabel="pendentes de venda ativa" /> : null}
    </ErpStats>
    <ErpToolbar>
      <ErpSearch label="Buscar parcela" placeholder={data.agency ? "Buscar cliente ou corretor" : "Buscar cliente"} value={data.filters.q} />
      <ErpMonthFilter value={data.filters.competence ?? ""} />
    </ErpToolbar>
    <CommissionsList data={data} />
  </ErpPage>;
}
