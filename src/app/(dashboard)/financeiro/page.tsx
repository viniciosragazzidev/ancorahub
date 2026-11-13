import { redirect } from "next/navigation";
import { getErpPlatformState } from "@/features/erp/access";
import { getFinancialEntries, getFinanceSelectors } from "@/features/erp/finance";
import { FINANCIAL_KINDS, FINANCIAL_LABELS } from "@/features/erp/contracts";
import { FinanceLedgerPage } from "@/features/erp/components/finance-ledger-page";

type Search = { kind?: string; status?: string; competence?: string; q?: string; page?: string };

export default async function FinancePage({ searchParams }: { searchParams: Promise<Search> }) {
  if (!(await getErpPlatformState()).enabled) redirect("/distribuicao?view=resumo_dia");
  const raw = await searchParams;
  const data = await getFinancialEntries({ ...raw, competence: raw.competence || undefined });
  const selectors = data.canPrepare ? await getFinanceSelectors() : null;
  const kinds = FINANCIAL_KINDS.filter((value) => data.agency || value === "broker_commission" || value === "advance");
  return <FinanceLedgerPage pathname="/financeiro" title={data.agency ? "Lançamentos" : "Meu financeiro"} data={data}
    branches={selectors?.branches ?? null} focus="all" defaultKind="agency_receivable" listTitle="Lançamentos"
    kindFilter={{ value: data.filters.kind, defaultValue: "all", options: [{ value: "all", label: "Todos os tipos" }, ...kinds.map((value) => ({ value, label: FINANCIAL_LABELS[value] }))] }}
    emptyText="Um valor ausente ainda não foi informado ou conferido. Ele não representa pagamento, recebimento ou inadimplência."
    help={<>
      <p>Mensalidade do cliente, recebimento da corretora e repasse ao corretor são fatos independentes: um não comprova o outro.</p>
      <p>Cada valor é preparado com referência e evidência e só vale depois que outra pessoa autorizada aprova. Quem recebe o valor nunca o aprova.</p>
      <p>Correções nunca apagam: um estorno compensa o movimento anterior e tudo fica no histórico. Nada aqui executa pagamento bancário.</p>
    </>} />;
}
