import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getReceipt } from "@/features/erp/payouts";
import { ReceiptPrintButton, ReceiptView } from "@/features/erp/components/payout-receipts";
import { ErpPage } from "@/features/erp/ui/erp-page";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getReceipt(id);
  const actions = <div className="flex flex-wrap gap-2 print:hidden">
    <Button variant="outline" render={<Link href="/financeiro/recibos" />}>Voltar aos recibos</Button>
    <ReceiptPrintButton />
  </div>;
  return <ErpPage pathname="/financeiro/recibos" breadcrumb="Recibos" title={`Recibo ${data.receipt.number}`} actions={actions}>
    <ReceiptView data={data} />
  </ErpPage>;
}
