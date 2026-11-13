import { redirect } from "next/navigation";
import { getFinancialEntries, getFinanceSelectors } from "@/features/erp/finance";
import { FinanceLedgerPage } from "@/features/erp/components/finance-ledger-page";

type Search = { status?: string; competence?: string; q?: string; page?: string };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = await searchParams;
  const data = await getFinancialEntries({ kind: "expense", status: raw.status, competence: raw.competence || undefined, q: raw.q, page: raw.page });
  if (!data.agency) redirect("/financeiro");
  const selectors = data.canPrepare ? await getFinanceSelectors() : null;
  return <FinanceLedgerPage pathname="/financeiro/despesas" title="Despesas" data={data} branches={selectors?.branches ?? null}
    focus="expenses" defaultKind="expense" listTitle="Despesas"
    emptyTitle="Nenhuma despesa neste filtro" emptyText="Uma despesa ausente ainda não foi informada ou conferida."
    help={<p>Cada despesa é preparada com evidência, aprovada por outra pessoa e paga por liquidação conferida. Nada aqui executa pagamento bancário.</p>} />;
}
