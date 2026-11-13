import { getOffsets } from "@/features/erp/offsets";
import { getFinancialEntries, getFinanceSelectors } from "@/features/erp/finance";
import { FinanceLedger } from "@/features/erp/components/finance-workspace";
import { OffsetPrepareButton, OffsetsList } from "@/features/erp/components/finance-controls";
import { ErpPage } from "@/features/erp/ui/erp-page";
import { ErpNote, ErpToolbar, ErpUrlFilter } from "@/features/erp/ui/erp-kit";

const VIEW_OPTIONS = [
  { value: "advances", label: "Adiantamentos" },
  { value: "offsets", label: "Compensações" },
];

type Search = { view?: string; page?: string };

/** One list per view (advances or offsets), each paginated by URL; "Preparar compensação" is the screen's primary CTA. */
export default async function AdvancesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = await searchParams;
  const view = raw.view === "offsets" ? "offsets" : "advances";
  const [offsets, entries] = await Promise.all([
    getOffsets({ page: view === "offsets" ? raw.page : undefined }),
    view === "advances" ? getFinancialEntries({ kind: "advance", page: raw.page }) : Promise.resolve(null),
  ]);
  const selectors = entries?.canPrepare ? await getFinanceSelectors() : null;
  return <ErpPage pathname="/financeiro/adiantamentos" breadcrumb="Financeiro" title="Adiantamentos e compensações"
    actions={<OffsetPrepareButton data={offsets} />}>
    <ErpNote>
      A concessão altera o caixa quando liquidada. A compensação usa o saldo comprovado do adiantamento e reduz o valor a repassar, sem uma segunda saída.
    </ErpNote>
    <ErpToolbar>
      <ErpUrlFilter label="Lista" param="view" value={view} defaultValue="advances" options={VIEW_OPTIONS} />
    </ErpToolbar>
    {entries ? <FinanceLedger data={entries} branches={selectors?.branches ?? null} title="Adiantamentos" defaultKind="advance" ctaVariant="outline"
      emptyTitle="Nenhum adiantamento" emptyText="Nenhum adiantamento foi preparado no seu escopo." /> : <OffsetsList data={offsets} />}
  </ErpPage>;
}
