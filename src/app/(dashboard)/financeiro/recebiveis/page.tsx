import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { getFinancialEntries, getFinanceSelectors } from "@/features/erp/finance";
import { FinancialEntriesTable, NewFinancialEntry } from "@/features/erp/components/finance-workspace";
import page from "@/components/lite/page/lite-page.module.css";

const KINDS = { agency_receivable: "Recebíveis da corretora", client_premium: "Mensalidades dos clientes" } as const;

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<{ kind?: string; status?: string; competence?: string; page?: string }> }) {
  const raw = await searchParams; const kind = raw.kind === "client_premium" ? "client_premium" : "agency_receivable";
  const data = await getFinancialEntries({ kind, status: raw.status, competence: raw.competence || undefined, page: raw.page });
  const selectors = data.canPrepare ? await getFinanceSelectors() : null;
  return <><DashboardHeader breadcrumb="Financeiro" title="Recebíveis e mensalidades" /><main className={page.stack}>
    <div className={page.toolbar}><p className="text-sm text-muted-foreground">O recebível é o que a operadora deve à corretora. A mensalidade é paga pelo cliente à operadora e não entra no caixa. Um fato não comprova o outro, e falta de registro não é inadimplência.</p>{selectors ? <NewFinancialEntry selectors={selectors} /> : null}</div>
    <form action="/financeiro/recebiveis" className={page.toolbar} aria-label="Filtrar recebíveis"><AppSelect name="kind" aria-label="Tipo" defaultValue={kind} options={Object.entries(KINDS).map(([value, label]) => ({ value, label }))} /><AppSelect name="status" aria-label="Estado" defaultValue={data.filters.status} options={[{ value: "all", label: "Todos os estados" }, { value: "submitted", label: "Aguardando aprovação" }, { value: "approved", label: "Aprovados" }, { value: "rejected", label: "Rejeitados" }]} /><Input type="month" name="competence" aria-label="Competência" defaultValue={data.filters.competence ?? ""} /><Button type="submit" variant="outline">Filtrar</Button></form>
    <FinancialEntriesTable data={data} />{data.total > 25 ? <p className="text-sm text-muted-foreground">Mostrando 25 de {data.total}. Use os filtros ou a lista completa no Financeiro.</p> : null}
  </main></>;
}
