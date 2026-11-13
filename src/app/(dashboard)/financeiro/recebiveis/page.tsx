import { redirect } from "next/navigation";
import { getFinancialEntries, getFinanceSelectors } from "@/features/erp/finance";
import { FinanceLedgerPage } from "@/features/erp/components/finance-ledger-page";

const KIND_OPTIONS = [
  { value: "agency_receivable", label: "Recebíveis da corretora" },
  { value: "client_premium", label: "Mensalidades dos clientes" },
];

type Search = { kind?: string; status?: string; competence?: string; q?: string; page?: string };

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = await searchParams;
  const kind = raw.kind === "client_premium" ? "client_premium" : "agency_receivable";
  const data = await getFinancialEntries({ kind, status: raw.status, competence: raw.competence || undefined, q: raw.q, page: raw.page });
  if (!data.agency) redirect("/financeiro");
  const selectors = data.canPrepare ? await getFinanceSelectors() : null;
  return <FinanceLedgerPage pathname="/financeiro/recebiveis" title="Recebíveis" data={data} branches={selectors?.branches ?? null}
    focus="receivables" defaultKind={kind} listTitle={kind === "client_premium" ? "Mensalidades" : "Recebíveis"}
    kindFilter={{ value: kind, defaultValue: "agency_receivable", options: KIND_OPTIONS }}
    emptyTitle="Nenhum registro neste filtro" emptyText="Falta de registro não é inadimplência: o valor ainda não foi informado ou conferido."
    help={<>
      <p>O recebível é o que a operadora deve à corretora. A mensalidade é paga pelo cliente à operadora e não entra no caixa da corretora.</p>
      <p>Um fato não comprova o outro, e falta de registro não é inadimplência.</p>
    </>} />;
}
