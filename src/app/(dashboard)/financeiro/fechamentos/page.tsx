import { StatCard } from "@/components/dashboard/metric-card";
import { getClosings } from "@/features/erp/closing";
import { ClosingsWorkspace } from "@/features/erp/components/finance-controls";
import { ErpPage } from "@/features/erp/ui/erp-page";
import { ErpHeaderActions, ErpHelp, ErpPrimaryAction, ErpStats } from "@/features/erp/ui/erp-kit";
import { formatCompetence } from "@/features/erp/ui/format";

export default async function ClosingsPage() {
  const data = await getClosings();
  const count = (status: string) => data.rows.filter((row) => row.status === status).length;
  const lastClosed = data.rows.find((row) => row.status === "closed");
  const actions = <ErpHeaderActions>
    <ErpHelp title="Como funciona: Fechamentos">
      <p>Prepare a memória dos fatos do mês, peça a conferência independente e feche o período. Depois de fechado, o mês não aceita mudanças.</p>
      <p>Uma alteração depois da prévia exige nova conferência. A reabertura pede motivo e mantém o retrato anterior no histórico.</p>
    </ErpHelp>
    {data.canPrepare ? <ErpPrimaryAction label="Preparar competência" param="preparar" /> : null}
  </ErpHeaderActions>;
  return <ErpPage pathname="/financeiro/fechamentos" breadcrumb="Financeiro" title="Fechamentos" actions={actions}>
    <ErpStats>
      <StatCard label="Último mês fechado" value={lastClosed ? formatCompetence(lastClosed.competence) : "Nenhum"} sublabel="período sem mudanças" />
      <StatCard label="Aguardando aprovação" value={count("pending").toLocaleString("pt-BR")} sublabel="prévia preparada" />
      <StatCard label="Fechados" value={count("closed").toLocaleString("pt-BR")} sublabel="nas últimas 36 competências" />
      <StatCard label="Reabertos" value={count("reopened").toLocaleString("pt-BR")} sublabel="com motivo registrado" />
    </ErpStats>
    <ClosingsWorkspace data={data} />
  </ErpPage>;
}
