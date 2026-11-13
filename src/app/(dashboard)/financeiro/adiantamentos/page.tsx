import { StatCard } from "@/components/dashboard/metric-card";
import { getOffsets } from "@/features/erp/offsets";
import { getFinancialEntries, getFinanceSelectors } from "@/features/erp/finance";
import { formatCents } from "@/features/erp/contracts";
import { FinanceLedger } from "@/features/erp/components/finance-workspace";
import { OffsetPreparePanel, OffsetsList } from "@/features/erp/components/finance-controls";
import { ErpPage } from "@/features/erp/ui/erp-page";
import { ErpHeaderActions, ErpHelp, ErpPrimaryAction, ErpSearch, ErpStats, ErpToolbar, ErpUrlFilter } from "@/features/erp/ui/erp-kit";

const VIEW_OPTIONS = [
  { value: "advances", label: "Adiantamentos" },
  { value: "offsets", label: "Compensações" },
];

type Search = { view?: string; q?: string; page?: string };

/** One list per view (advances or offsets), each paginated by URL; one primary CTA per view in the header. */
export default async function AdvancesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = await searchParams;
  const view = raw.view === "offsets" ? "offsets" : "advances";
  const [offsets, entries] = await Promise.all([
    getOffsets({ page: view === "offsets" ? raw.page : undefined }),
    getFinancialEntries({ kind: "advance", q: view === "advances" ? raw.q : undefined, page: view === "advances" ? raw.page : undefined }),
  ]);
  const selectors = entries.canPrepare ? await getFinanceSelectors() : null;
  const primary = view === "advances"
    ? (entries.canPrepare && selectors ? <ErpPrimaryAction label="Novo adiantamento" /> : null)
    : (offsets.canPrepare ? <ErpPrimaryAction label="Preparar compensação" param="compensar" /> : null);
  const actions = <ErpHeaderActions>
    <ErpHelp title="Como funciona: Adiantamentos">
      <p>A concessão do adiantamento altera o caixa quando liquidada, como qualquer saída conferida.</p>
      <p>A compensação usa o saldo comprovado do adiantamento e reduz o valor a repassar ao corretor, sem uma segunda saída de caixa.</p>
      <p>Toda compensação é conferida por outra pessoa autorizada e pode ser estornada com motivo; nada é apagado.</p>
    </ErpHelp>
    {primary}
  </ErpHeaderActions>;
  return <ErpPage pathname="/financeiro/adiantamentos" breadcrumb="Financeiro" title="Adiantamentos" actions={actions}>
    <ErpStats>
      <StatCard label="Concedido" value={formatCents(entries.summary.approvedCents)} sublabel="adiantamentos aprovados" />
      <StatCard label="Pago" value={formatCents(entries.summary.settledCents)} sublabel="liquidações confirmadas" />
      <StatCard label="Compensado" value={formatCents(offsets.summary.confirmedCents)} sublabel="descontado de comissões" />
      <StatCard label="A conferir" value={(entries.summary.toReview + offsets.summary.pending).toLocaleString("pt-BR")} sublabel="adiantamentos e compensações" />
    </ErpStats>
    <ErpToolbar>
      {view === "advances" ? <ErpSearch label="Buscar adiantamento" placeholder="Buscar descrição, referência ou pessoa" value={entries.filters.q} /> : null}
      <ErpUrlFilter label="Lista" param="view" value={view} defaultValue="advances" options={VIEW_OPTIONS} />
    </ErpToolbar>
    {view === "advances"
      ? <FinanceLedger data={entries} branches={selectors?.branches ?? null} title="Adiantamentos" defaultKind="advance"
        emptyTitle="Nenhum adiantamento" emptyText="Nenhum adiantamento foi preparado no seu escopo." />
      : <OffsetsList data={offsets} />}
    <OffsetPreparePanel data={offsets} />
  </ErpPage>;
}
