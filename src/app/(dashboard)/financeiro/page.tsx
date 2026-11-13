import { redirect } from "next/navigation";
import { getErpPlatformState } from "@/features/erp/access";
import { getFinancialEntries, getFinanceSelectors } from "@/features/erp/finance";
import { FINANCIAL_KINDS, FINANCIAL_LABELS } from "@/features/erp/contracts";
import { FinanceLedger } from "@/features/erp/components/finance-workspace";
import { ENTRY_STATUS_OPTIONS } from "@/features/erp/components/ledger-filters";
import { ErpPage } from "@/features/erp/ui/erp-page";
import { ErpMonthFilter, ErpNote, ErpToolbar, ErpUrlFilter } from "@/features/erp/ui/erp-kit";

type Search = { kind?: string; status?: string; competence?: string; page?: string };

export default async function FinancePage({ searchParams }: { searchParams: Promise<Search> }) {
  if (!(await getErpPlatformState()).enabled) redirect("/distribuicao?view=resumo_dia");
  const raw = await searchParams;
  const data = await getFinancialEntries({ ...raw, competence: raw.competence || undefined });
  const selectors = data.canPrepare ? await getFinanceSelectors() : null;
  const kinds = FINANCIAL_KINDS.filter((value) => data.agency || value === "broker_commission" || value === "advance");
  const kindOptions = [{ value: "all", label: "Todos os tipos" }, ...kinds.map((value) => ({ value, label: FINANCIAL_LABELS[value] }))];
  return <ErpPage pathname="/financeiro" breadcrumb="Operação" title={data.agency ? "Financeiro" : "Meu financeiro"}>
    <ErpNote>
      Mensalidade, recebimento da Âncora e repasse são fatos independentes. Valores são registrados por conferência, com aprovação e evidência.
    </ErpNote>
    <ErpToolbar>
      <ErpUrlFilter label="Tipo de lançamento" param="kind" value={data.filters.kind} defaultValue="all" options={kindOptions} />
      <ErpUrlFilter label="Estado da conferência" param="status" value={data.filters.status} defaultValue="all" options={ENTRY_STATUS_OPTIONS} />
      <ErpMonthFilter value={data.filters.competence ?? ""} />
    </ErpToolbar>
    <FinanceLedger data={data} branches={selectors?.branches ?? null} title="Lançamentos" defaultKind="agency_receivable"
      emptyText="Um valor ausente ainda não foi informado ou conferido. Ele não representa pagamento, recebimento ou inadimplência." />
  </ErpPage>;
}
