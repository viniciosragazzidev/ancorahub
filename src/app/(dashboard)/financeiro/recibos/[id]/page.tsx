import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { getReceipt } from "@/features/erp/payouts";
import { ReceiptView } from "@/features/erp/components/payout-workspace";
import page from "@/components/lite/page/lite-page.module.css";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { receipt, digest } = await getReceipt(id);
  return <><DashboardHeader breadcrumb="Recibos" title={`Recibo ${receipt.number}`} /><main className={page.stack}><div className="print:hidden"><Button variant="outline" render={<Link href="/financeiro/recibos" />}>Voltar aos recibos</Button></div><ReceiptView receipt={receipt} digest={digest} /></main></>;
}
