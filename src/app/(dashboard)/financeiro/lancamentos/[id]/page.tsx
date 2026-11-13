import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getFinancialEntry } from "@/features/erp/finance";
import { FinancialEntryDetail } from "@/features/erp/components/ledger-entry-detail";
import { ErpPage } from "@/features/erp/ui/erp-page";

export default async function FinancialEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getFinancialEntry(id);
  return <ErpPage pathname={`/financeiro/lancamentos/${id}`} breadcrumb="Financeiro" title={detail.entry.reference}
    actions={<Button variant="outline" render={<Link href="/financeiro" />}>Voltar ao financeiro</Button>}>
    <FinancialEntryDetail detail={detail} />
  </ErpPage>;
}
