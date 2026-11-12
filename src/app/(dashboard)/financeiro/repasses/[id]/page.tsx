import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { getPayout } from "@/features/erp/payouts";
import { PayoutDetail } from "@/features/erp/components/payout-workspace";
import page from "@/components/lite/page/lite-page.module.css";

export default async function PayoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const detail = await getPayout(id);
  return <><DashboardHeader breadcrumb="Repasses" title={`Repasse de ${detail.beneficiaryName}`} /><main className={page.stack}><div><Button variant="outline" render={<Link href="/financeiro/repasses" />}>Voltar aos repasses</Button></div><PayoutDetail detail={detail} /></main></>;
}
