import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { getFinancialEntries, getFinanceSelectors } from "@/features/erp/finance";
import { FinancialEntriesTable, NewFinancialEntry } from "@/features/erp/components/finance-workspace";
import page from "@/components/lite/page/lite-page.module.css";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ status?: string; competence?: string; page?: string }> }) {
  const raw = await searchParams; const data = await getFinancialEntries({ kind: "expense", status: raw.status, competence: raw.competence || undefined, page: raw.page });
  const selectors = data.canPrepare ? await getFinanceSelectors() : null;
  return <><DashboardHeader breadcrumb="Financeiro" title="Despesas" /><main className={page.stack}>
    <div className={page.toolbar}><p className="text-sm text-muted-foreground">Cada despesa é preparada com evidência, aprovada por outra pessoa e paga por liquidação conferida. Nada aqui executa pagamento bancário.</p>{selectors ? <NewFinancialEntry selectors={selectors} /> : null}</div>
    <form action="/financeiro/despesas" className={page.toolbar} aria-label="Filtrar despesas"><AppSelect name="status" aria-label="Estado" defaultValue={data.filters.status} options={[{ value: "all", label: "Todos os estados" }, { value: "submitted", label: "Aguardando aprovação" }, { value: "approved", label: "Aprovadas" }, { value: "rejected", label: "Rejeitadas" }]} /><Input type="month" name="competence" aria-label="Competência" defaultValue={data.filters.competence ?? ""} /><Button type="submit" variant="outline">Filtrar</Button></form>
    <FinancialEntriesTable data={data} />{data.total > 25 ? <p className="text-sm text-muted-foreground">Mostrando 25 de {data.total}. Use os filtros para ver as demais.</p> : null}
  </main></>;
}
