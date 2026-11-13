import { ZodError } from "zod";
import { ErpError } from "@/features/erp/contracts";
import { getPayouts, getReceipt } from "@/features/erp/payouts";
import { ReceiptsList } from "@/features/erp/components/payout-receipts";
import { ErpPage } from "@/features/erp/ui/erp-page";

/** The drawer's receipt: a missing or out-of-scope id shows a note in the drawer instead of breaking the list. */
async function openReceipt(id: string | undefined) {
  if (!id) return { preview: null, missing: false };
  try {
    return { preview: await getReceipt(id), missing: false };
  } catch (error) {
    if (error instanceof ErpError || error instanceof ZodError) return { preview: null, missing: true };
    throw error;
  }
}

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ competence?: string; page?: string; recibo?: string }> }) {
  const raw = await searchParams;
  const [data, opened] = await Promise.all([
    getPayouts({ status: "settled", competence: raw.competence || undefined, page: raw.page }),
    openReceipt(raw.recibo),
  ]);
  return <ErpPage pathname="/financeiro/recibos" breadcrumb="Financeiro" title={data.agency ? "Recibos" : "Meus recibos"}>
    <ReceiptsList data={data} preview={opened.preview} previewMissing={opened.missing} />
  </ErpPage>;
}
