import { StatCard } from "@/components/dashboard/metric-card";
import { getCashMovements } from "@/features/erp/closing";
import { formatCents } from "@/features/erp/contracts";
import { currentPeriod, periodSchema } from "@/features/erp/shared";
import { CashKindsList } from "@/features/erp/components/finance-controls";
import { ErpPage } from "@/features/erp/ui/erp-page";
import { ErpHeaderActions, ErpHelp, ErpMonthFilter, ErpStats, ErpToolbar } from "@/features/erp/ui/erp-kit";
import { formatCompetence } from "@/features/erp/ui/format";

export default async function CashPage({ searchParams }: { searchParams: Promise<{ competence?: string }> }) {
  const params = await searchParams;
  const requested = periodSchema.safeParse(params.competence);
  const data = await getCashMovements(requested.success ? requested.data : currentPeriod());
  const actions = <ErpHeaderActions><ErpHelp title="Como funciona: Caixa">
    <p>Entram somente liquidações confirmadas por outra pessoa, com os estornos compensatórios já descontados.</p>
    <p>Mensalidades pagas pelo cliente à operadora e compensações internas não são movimento de caixa da corretora.</p>
    <p>O saldo inicial não é informado: a variação do mês não representa o saldo bancário.</p>
  </ErpHelp></ErpHeaderActions>;
  return <ErpPage pathname="/financeiro/fluxo-caixa" breadcrumb="Financeiro" title="Caixa" actions={actions}>
    <ErpStats>
      <StatCard label="Entradas" value={formatCents(data.incoming)} sublabel="recebíveis liquidados" />
      <StatCard label="Saídas" value={formatCents(data.outgoing)} sublabel="comissões, despesas e adiantamentos" />
      <StatCard label="Variação no mês" value={formatCents(data.net)} sublabel="entradas menos saídas" />
      <StatCard label="Movimentos" value={data.movementCount.toLocaleString("pt-BR")} sublabel="liquidações confirmadas" />
    </ErpStats>
    <ErpToolbar><ErpMonthFilter label="Mês dos movimentos" value={data.competence} allLabel={null} /></ErpToolbar>
    <CashKindsList rows={data.byKind} monthLabel={formatCompetence(data.competence, "long")} />
  </ErpPage>;
}
