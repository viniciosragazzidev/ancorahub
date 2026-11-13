import { redirect } from "next/navigation";
import { getFinancialEntries, getFinanceSelectors } from "@/features/erp/finance";
import { FinanceLedger } from "@/features/erp/components/finance-workspace";
import { ENTRY_STATUS_OPTIONS } from "@/features/erp/components/ledger-filters";
import { ErpPage } from "@/features/erp/ui/erp-page";
import { ErpMonthFilter, ErpNote, ErpToolbar, ErpUrlFilter } from "@/features/erp/ui/erp-kit";

type Search = { status?: string; competence?: string; page?: string };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = await searchParams;
  const data = await getFinancialEntries({ kind: "expense", status: raw.status, competence: raw.competence || undefined, page: raw.page });
  if (!data.agency) redirect("/financeiro");
  const selectors = data.canPrepare ? await getFinanceSelectors() : null;
  return <ErpPage pathname="/financeiro/despesas" breadcrumb="Financeiro" title="Despesas">
    <ErpNote>
      Cada despesa é preparada com evidência, aprovada por outra pessoa e paga por liquidação conferida. Nada aqui executa pagamento bancário.
    </ErpNote>
    <ErpToolbar>
      <ErpUrlFilter label="Estado" param="status" value={data.filters.status} defaultValue="all" options={ENTRY_STATUS_OPTIONS} />
      <ErpMonthFilter value={data.filters.competence ?? ""} />
    </ErpToolbar>
    <FinanceLedger data={data} branches={selectors?.branches ?? null} title="Despesas" defaultKind="expense"
      emptyTitle="Nenhuma despesa neste filtro" emptyText="Uma despesa ausente ainda não foi informada ou conferida." />
  </ErpPage>;
}
