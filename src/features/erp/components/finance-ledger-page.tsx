import type { ReactNode } from "react";
import { StatCard } from "@/components/dashboard/metric-card";
import { formatCents, type FinancialKind } from "../contracts";
import type { getFinancialEntries, getFinanceSelectors } from "../finance";
import { ErpPage } from "../ui/erp-page";
import { ErpHeaderActions, ErpHelp, ErpMonthFilter, ErpPrimaryAction, ErpSearch, ErpStats, ErpToolbar, ErpUrlFilter } from "../ui/erp-kit";
import { ENTRY_STATUS_OPTIONS } from "./ledger-filters";
import { FinanceLedger } from "./finance-workspace";

type Entries = Awaited<ReturnType<typeof getFinancialEntries>>;
type Branches = Awaited<ReturnType<typeof getFinanceSelectors>>["branches"];
type Tile = { label: string; value: string; hint: string };

/** Which numbers the screen leads with. Agency screens show money in and out; the broker sees his own commissions. */
export type LedgerFocus = "all" | "receivables" | "expenses";

function tiles(data: Entries, focus: LedgerFocus): Tile[] {
  const { summary } = data;
  const toReview = { label: "A conferir", value: summary.toReview.toLocaleString("pt-BR"), hint: "aguardando outra pessoa" };
  if (!data.agency) return [
    { label: "Comissões aprovadas", value: formatCents(summary.approvedCents), hint: "valor conferido" },
    { label: "Já recebido", value: formatCents(summary.settledCents), hint: "pagamentos confirmados" },
    { label: "A receber", value: formatCents(summary.payableCents), hint: "aprovado e ainda em aberto" },
  ];
  if (focus === "receivables") return [toReview,
    { label: "A receber", value: formatCents(summary.receivableCents), hint: "aprovado e ainda em aberto" },
    { label: "Recebido", value: formatCents(summary.settledCents), hint: "liquidações confirmadas" },
    { label: "Aprovado", value: formatCents(summary.approvedCents), hint: "valor conferido no filtro" }];
  if (focus === "expenses") return [toReview,
    { label: "A pagar", value: formatCents(summary.payableCents), hint: "aprovado e ainda em aberto" },
    { label: "Pago", value: formatCents(summary.settledCents), hint: "liquidações confirmadas" },
    { label: "Aprovado", value: formatCents(summary.approvedCents), hint: "valor conferido no filtro" }];
  return [toReview,
    { label: "A receber", value: formatCents(summary.receivableCents), hint: "recebíveis em aberto" },
    { label: "A pagar", value: formatCents(summary.payableCents), hint: "comissões, despesas e adiantamentos" },
    { label: "Liquidado", value: formatCents(summary.settledCents), hint: "movimentos confirmados" }];
}

/**
 * One ledger screen (Lançamentos, Recebíveis, Despesas): header with "Como funciona" and the single CTA, the numbers
 * of the filter, the filter bar (search, type, state, month) and the table. Same order as /clientes and /equipe.
 */
export function FinanceLedgerPage({ pathname, title, data, branches, focus, defaultKind, kindFilter, help, listTitle, emptyTitle, emptyText }: {
  pathname: string; title: string; data: Entries; branches: Branches | null; focus: LedgerFocus; defaultKind: FinancialKind;
  /** Type filter; omitted when the screen is a single type. */
  kindFilter?: { value: string; defaultValue: string; options: { value: string; label: string }[] };
  help: ReactNode; listTitle: string; emptyTitle?: string; emptyText: string;
}) {
  const actions = <ErpHeaderActions>
    <ErpHelp title={`Como funciona: ${title}`}>{help}</ErpHelp>
    {data.canPrepare && branches ? <ErpPrimaryAction label="Novo lançamento" /> : null}
  </ErpHeaderActions>;
  return <ErpPage pathname={pathname} breadcrumb="Financeiro" title={title} actions={actions}>
    <ErpStats>{tiles(data, focus).map((tile) => <StatCard key={tile.label} label={tile.label} value={tile.value} sublabel={tile.hint} />)}</ErpStats>
    <ErpToolbar>
      <ErpSearch label="Buscar lançamento" placeholder="Buscar descrição, referência ou pessoa" value={data.filters.q} />
      {kindFilter ? <ErpUrlFilter label="Tipo" param="kind" value={kindFilter.value} defaultValue={kindFilter.defaultValue} options={kindFilter.options} /> : null}
      <ErpUrlFilter label="Estado" param="status" value={data.filters.status} defaultValue="all" options={ENTRY_STATUS_OPTIONS} />
      <ErpMonthFilter value={data.filters.competence ?? ""} />
    </ErpToolbar>
    <FinanceLedger data={data} branches={branches} title={listTitle} defaultKind={defaultKind} emptyTitle={emptyTitle} emptyText={emptyText} />
  </ErpPage>;
}
