import { DashboardHeader } from "@/components/dashboard-header";
import { getOffsets } from "@/features/erp/offsets";
import { getFinancialEntries, getFinanceSelectors } from "@/features/erp/finance";
import { NewFinancialEntry, FinancialEntriesTable } from "@/features/erp/components/finance-workspace";
import { OffsetPreparation, OffsetsList } from "@/features/erp/components/finance-controls";
import page from "@/components/lite/page/lite-page.module.css";
export default async function AdvancesPage() {
  const entries = await getFinancialEntries({ kind: "advance" }); const offsets = await getOffsets(); const selectors = entries.canPrepare ? await getFinanceSelectors() : null;
  return <><DashboardHeader breadcrumb="Financeiro" title="Adiantamentos e compensações" /><main className={page.stack}><div className={page.toolbar}><p className="text-sm text-muted-foreground">A concessão altera o caixa quando liquidada. A compensação usa o saldo comprovado do adiantamento e reduz o valor a repassar, sem uma segunda saída.</p>{selectors ? <NewFinancialEntry selectors={selectors} /> : null}</div><FinancialEntriesTable data={entries} />{entries.total > 25 ? <p className="text-sm text-muted-foreground">Mostrando 25 adiantamentos recentes. Consulte os demais no Financeiro com filtro de tipo.</p> : null}{offsets.canPrepare ? <details><summary className="cursor-pointer text-sm font-medium">Preparar compensação autorizada</summary><OffsetPreparation data={offsets} /></details> : null}<OffsetsList data={offsets} /></main></>;
}
