import Link from "next/link";
import { redirect } from "next/navigation";
import { getErpPlatformState } from "@/features/erp/access";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { getFinancialEntries, getFinanceSelectors } from "@/features/erp/finance";
import { FINANCIAL_KINDS, FINANCIAL_LABELS } from "@/features/erp/contracts";
import { FinancialEntriesTable, NewFinancialEntry } from "@/features/erp/components/finance-workspace";
import page from "@/components/lite/page/lite-page.module.css";

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ kind?: string; status?: string; competence?: string; page?: string }> }) {
  if (!(await getErpPlatformState()).enabled) redirect("/distribuicao?view=resumo_dia");
  const raw = await searchParams; const data = await getFinancialEntries({ ...raw, competence: raw.competence || undefined });
  const selectors = data.canPrepare ? await getFinanceSelectors() : null;
  const target = (number: number) => `/financeiro?${new URLSearchParams({ kind: data.filters.kind, status: data.filters.status, ...(data.filters.competence ? { competence: data.filters.competence } : {}), page: String(number) })}`;
  return <><DashboardHeader breadcrumb="Operação" title={data.agency ? "Financeiro" : "Meu financeiro"} /><main className={page.stack}><div className={page.toolbar}><p className="text-sm text-muted-foreground">Mensalidade, recebimento da Âncora e repasse são fatos independentes. Valores são registrados por conferência, com aprovação e evidência.</p>{selectors ? <NewFinancialEntry selectors={selectors} /> : null}</div>
    <form action="/financeiro" className={page.toolbar} aria-label="Filtrar lançamentos"><AppSelect name="kind" aria-label="Tipo de lançamento" defaultValue={data.filters.kind} options={[{ value: "all", label: "Todos os tipos" }, ...FINANCIAL_KINDS.filter((value) => data.agency || ["broker_commission", "advance"].includes(value)).map((value) => ({ value, label: FINANCIAL_LABELS[value] }))]} /><AppSelect name="status" aria-label="Estado da conferência" defaultValue={data.filters.status} options={[{ value: "all", label: "Todos os estados" }, { value: "submitted", label: "Aguardando aprovação" }, { value: "approved", label: "Aprovados" }, { value: "rejected", label: "Rejeitados" }]} /><Input type="month" name="competence" aria-label="Competência" defaultValue={data.filters.competence ?? ""} /><Button type="submit" variant="outline">Filtrar</Button></form>
    <FinancialEntriesTable data={data} /><nav aria-label="Paginação financeira" className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{data.total} lançamento(s) · página {data.filters.page}</p><div className="flex gap-2">{data.filters.page > 1 ? <Button variant="outline" render={<Link href={target(data.filters.page - 1)} />}>Anterior</Button> : null}{data.filters.page * 25 < data.total ? <Button variant="outline" render={<Link href={target(data.filters.page + 1)} />}>Próxima</Button> : null}</div></nav>
  </main></>;
}
