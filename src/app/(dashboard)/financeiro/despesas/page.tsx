import { redirect } from "next/navigation";
import { getFinancialEntries, getFinanceSelectors } from "@/features/erp/finance";
import { generateDueRecurringExpensesSafely } from "@/features/erp/recurring-expenses";
import { FinanceLedgerPage } from "@/features/erp/components/finance-ledger-page";

type Search = { status?: string; competence?: string; q?: string; page?: string };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = await searchParams;
  // Despesas que se repetem: o mês que virou é gerado aqui, ao abrir a tela, sem job agendado.
  await generateDueRecurringExpensesSafely();
  const data = await getFinancialEntries({ kind: "expense", status: raw.status, competence: raw.competence || undefined, q: raw.q, page: raw.page });
  if (!data.agency) redirect("/financeiro");
  const selectors = data.canPrepare ? await getFinanceSelectors() : null;
  return <FinanceLedgerPage pathname="/financeiro/despesas" title="Despesas" data={data} branches={selectors?.branches ?? null}
    focus="expenses" defaultKind="expense" listTitle="Despesas"
    emptyTitle="Nenhuma despesa neste filtro" emptyText="Uma despesa ausente ainda não foi informada ou conferida."
    help={<><p>Cada despesa é preparada com evidência, aprovada por outra pessoa e paga por liquidação conferida. Nada aqui executa pagamento bancário.</p>
      <p>Aluguel, internet e outras contas fixas podem ser marcadas como "Repetir todo mês". Quando o mês vira, a despesa do mês novo aparece aqui para conferir. Para encerrar, use "Parar de repetir" no menu da linha.</p></>} />;
}
