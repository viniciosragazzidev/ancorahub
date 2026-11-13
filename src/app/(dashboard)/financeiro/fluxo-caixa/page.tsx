import { StatCard } from "@/components/dashboard/metric-card";
import { getCashMovements } from "@/features/erp/closing";
import { formatCents } from "@/features/erp/contracts";
import { currentPeriod, periodSchema } from "@/features/erp/shared";
import { ErpPage } from "@/features/erp/ui/erp-page";
import { ErpMonthFilter, ErpNote, ErpSection, ErpToolbar } from "@/features/erp/ui/erp-kit";

export default async function CashPage({ searchParams }: { searchParams: Promise<{ competence?: string }> }) {
  const params = await searchParams;
  const requested = periodSchema.safeParse(params.competence);
  const data = await getCashMovements(requested.success ? requested.data : currentPeriod());
  return <ErpPage pathname="/financeiro/fluxo-caixa" breadcrumb="Financeiro" title="Movimentação de caixa">
    <ErpToolbar><ErpMonthFilter label="Mês dos movimentos" value={data.competence} /></ErpToolbar>
    <ErpNote>
      Somente liquidações confirmadas, com estornos compensatórios. Mensalidades pagas à operadora e compensações internas não entram como movimento
      de caixa da Âncora.
    </ErpNote>
    <ErpSection title={`Competência ${data.competence}`} description={`${data.movementCount} movimento(s) confirmado(s)`}>
      {data.movementCount ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        <StatCard label="Entradas" value={formatCents(data.incoming)} sublabel="recebíveis liquidados" />
        <StatCard label="Saídas" value={formatCents(data.outgoing)} sublabel="comissões, despesas e adiantamentos" />
        <StatCard label="Variação líquida no mês" value={formatCents(data.net)} sublabel="entradas menos saídas" />
      </div> : <ErpNote>Nenhum movimento confirmado informado neste mês e escopo.</ErpNote>}
    </ErpSection>
    <ErpNote>Saldo inicial não informado. A variação líquida não representa o saldo bancário.</ErpNote>
  </ErpPage>;
}
