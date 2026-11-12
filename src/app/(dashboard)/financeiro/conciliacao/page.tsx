import { DashboardHeader } from "@/components/dashboard-header";
import { getReconciliation } from "@/features/erp/reconciliation";
import { ReconciliationList } from "@/features/erp/components/payout-workspace";
import page from "@/components/lite/page/lite-page.module.css";

export default async function ReconciliationPage() {
  const data = await getReconciliation();
  return <><DashboardHeader breadcrumb="Financeiro" title="Conciliação" /><main className={page.stack}>
    <p className="text-sm text-muted-foreground">Fila do que precisa de uma pessoa: evidência faltando, aprovação, movimentos a conferir, vencidos sem registro e diferenças com o cronograma antigo. Atualizado em {new Date(data.calculatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</p>
    <ReconciliationList data={data} />
  </main></>;
}
