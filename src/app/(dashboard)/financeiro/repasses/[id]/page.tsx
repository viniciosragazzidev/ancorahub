import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getPayout } from "@/features/erp/payouts";
import { PayoutDetailPage } from "@/features/erp/components/payout-detail";
import { ErpPage } from "@/features/erp/ui/erp-page";

export default async function PayoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getPayout(id);
  const back = <Button variant="outline" render={<Link href="/financeiro/repasses" />}>Voltar aos repasses</Button>;
  return <ErpPage pathname="/financeiro/repasses" breadcrumb="Repasses" title={`Repasse de ${detail.beneficiaryName}`} actions={back}>
    <PayoutDetailPage detail={detail} />
  </ErpPage>;
}
