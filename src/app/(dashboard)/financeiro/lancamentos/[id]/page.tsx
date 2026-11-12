import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { getFinancialEntry } from "@/features/erp/finance";
import { FinancialEntryDetail } from "@/features/erp/components/finance-workspace";
import page from "@/components/lite/page/lite-page.module.css";
export default async function FinancialEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const detail = await getFinancialEntry(id);
  return <><DashboardHeader breadcrumb="Financeiro" title={detail.entry.reference} /><main className={page.stack}><div><Button variant="outline" render={<Link href="/financeiro" />}>Voltar ao financeiro</Button></div><FinancialEntryDetail detail={detail} /></main></>;
}
