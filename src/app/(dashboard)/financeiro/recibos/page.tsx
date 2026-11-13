import { ZodError } from "zod";
import { ErpError } from "@/features/erp/contracts";
import { getPayouts, getReceipt } from "@/features/erp/payouts";
import { IMMUTABLE_NOTE, ReceiptsList } from "@/features/erp/components/payout-receipts";
import { StatCard } from "@/components/dashboard/metric-card";
import { formatCents } from "@/features/erp/contracts";
import { ErpHeaderActions, ErpHelp, ErpMonthFilter, ErpSearch, ErpStats, ErpToolbar } from "@/features/erp/ui/erp-kit";
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

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ competence?: string; q?: string; page?: string; recibo?: string }> }) {
  const raw = await searchParams;
  const [data, opened] = await Promise.all([
    getPayouts({ status: "settled", competence: raw.competence || undefined, q: raw.q, page: raw.page }),
    openReceipt(raw.recibo),
  ]);
  const actions = <ErpHeaderActions><ErpHelp title="Como funciona: Recibos">
    <p>O recibo é emitido quando outra pessoa confere o pagamento de um repasse.</p>
    <p>{IMMUTABLE_NOTE}</p>
    <p>É um documento interno de conferência: não é comprovante bancário nem nota fiscal.</p>
  </ErpHelp></ErpHeaderActions>;
  return <ErpPage pathname="/financeiro/recibos" breadcrumb="Financeiro" title={data.agency ? "Recibos" : "Meus recibos"} actions={actions}>
    <ErpStats>
      <StatCard label="Recibos emitidos" value={data.summary.settled.toLocaleString("pt-BR")} sublabel="repasses conferidos" />
      <StatCard label="Total pago" value={formatCents(data.summary.settledCents)} sublabel="valor líquido dos recibos" />
    </ErpStats>
    <ErpToolbar>
      {data.agency ? <ErpSearch label="Buscar recibo" placeholder="Buscar beneficiário ou número" value={data.filters.q} /> : null}
      <ErpMonthFilter value={data.filters.competence ?? ""} />
    </ErpToolbar>
    <ReceiptsList data={data} preview={opened.preview} previewMissing={opened.missing} />
  </ErpPage>;
}
