import { redirect } from "next/navigation";
import { getFinancialEntries, getFinanceSelectors } from "@/features/erp/finance";
import { FinanceLedger } from "@/features/erp/components/finance-workspace";
import { ENTRY_STATUS_OPTIONS } from "@/features/erp/components/ledger-filters";
import { ErpPage } from "@/features/erp/ui/erp-page";
import { ErpMonthFilter, ErpNote, ErpToolbar, ErpUrlFilter } from "@/features/erp/ui/erp-kit";

const KIND_OPTIONS = [
  { value: "agency_receivable", label: "Recebíveis da corretora" },
  { value: "client_premium", label: "Mensalidades dos clientes" },
];

type Search = { kind?: string; status?: string; competence?: string; page?: string };

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = await searchParams;
  const kind = raw.kind === "client_premium" ? "client_premium" : "agency_receivable";
  const data = await getFinancialEntries({ kind, status: raw.status, competence: raw.competence || undefined, page: raw.page });
  if (!data.agency) redirect("/financeiro");
  const selectors = data.canPrepare ? await getFinanceSelectors() : null;
  return <ErpPage pathname="/financeiro/recebiveis" breadcrumb="Financeiro" title="Recebíveis e mensalidades">
    <ErpNote>
      O recebível é o que a operadora deve à corretora. A mensalidade é paga pelo cliente à operadora e não entra no caixa.
      Um fato não comprova o outro, e falta de registro não é inadimplência.
    </ErpNote>
    <ErpToolbar>
      <ErpUrlFilter label="Tipo" param="kind" value={kind} defaultValue="agency_receivable" options={KIND_OPTIONS} />
      <ErpUrlFilter label="Estado" param="status" value={data.filters.status} defaultValue="all" options={ENTRY_STATUS_OPTIONS} />
      <ErpMonthFilter value={data.filters.competence ?? ""} />
    </ErpToolbar>
    <FinanceLedger data={data} branches={selectors?.branches ?? null} title={kind === "client_premium" ? "Mensalidades" : "Recebíveis"}
      defaultKind={kind} emptyTitle="Nenhum registro neste filtro"
      emptyText="Falta de registro não é inadimplência: o valor ainda não foi informado ou conferido." />
  </ErpPage>;
}
