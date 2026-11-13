"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCents } from "../contracts";
import type { getPayouts, getReceipt, PayoutReceipt } from "../payouts";
import { ErpList, ErpMonthFilter, ErpNote, ErpPager, ErpPanel, ErpSection, ErpToolbar, type ErpColumn } from "../ui/erp-kit";
import { formatDay, PayoutFacts, useUrlPanel } from "./payout-parts";

type ReceiptList = Awaited<ReturnType<typeof getPayouts>>;
type ReceiptRow = ReceiptList["rows"][number];
export type ReceiptData = Awaited<ReturnType<typeof getReceipt>>;
type ReceiptItem = PayoutReceipt["items"][number];

const IMMUTABLE_NOTE = "Cada recibo é uma versão fixa dos itens pagos e das compensações; um estorno posterior não altera o recibo, gera um novo evento.";

/** Receipts: one list; the row opens a preview drawer with "Abrir para imprimir". */
export function ReceiptsList({ data, preview, previewMissing }: { data: ReceiptList; preview: ReceiptData | null; previewMissing: boolean }) {
  const panel = useUrlPanel("recibo");
  const [openId, setOpenId] = useState<string | null>(panel.value);
  const shown = preview && preview.id === openId ? preview : null;
  const openReceipt = (id: string) => {
    setOpenId(id);
    panel.open(id);
  };
  const close = () => {
    setOpenId(null);
    panel.close();
  };
  const columns: ErpColumn<ReceiptRow>[] = [
    { id: "number", label: "Recibo", primary: true, nowrap: true, render: (row) => row.receiptNumber ?? "—" },
    { id: "beneficiary", label: "Beneficiário", secondary: true, nowrap: true, render: (row) => row.beneficiaryName },
    { id: "competence", label: "Competência", render: (row) => row.competence },
    { id: "paidOn", label: "Pago em", render: (row) => formatDay(row.occurredOn) },
    { id: "net", label: "Valor líquido", numeric: true, render: (row) => formatCents(row.netCents) },
  ];
  return <>
    <ErpNote>Recibos de repasses conferidos. {IMMUTABLE_NOTE}</ErpNote>
    <ErpToolbar><ErpMonthFilter value={data.filters.competence ?? ""} /></ErpToolbar>
    <ErpList title={data.agency ? "Recibos" : "Meus recibos"} columns={columns} rows={data.rows} rowKey={(row) => row.id}
      onRowOpen={(row) => openReceipt(row.id)} emptyTitle="Nenhum recibo emitido"
      emptyText="O recibo é emitido quando o pagamento de um repasse é conferido por outra pessoa."
      footer={<ErpPager page={data.filters.page} total={data.total} pageSize={data.pageSize} label="Paginação de recibos" />} />
    <ErpPanel open={openId !== null} onOpenChange={(open) => { if (!open) close(); }}
      title={shown ? `Recibo ${shown.receipt.number}` : "Recibo"} description={shown ? `Competência ${shown.receipt.competence}` : undefined}>
      {shown ? <>
        <ReceiptFacts data={shown} />
        <ErpNote>{shown.receipt.items.length} comissão(ões) neste recibo.</ErpNote>
        <div><Button render={<Link href={`/financeiro/recibos/${shown.id}`} />}>Abrir para imprimir</Button></div>
      </> : previewMissing && panel.value === openId
        ? <ErpNote>Recibo não encontrado no seu escopo.</ErpNote>
        : <p className="text-sm text-muted-foreground" role="status">Carregando recibo…</p>}
    </ErpPanel>
  </>;
}

function ReceiptFacts({ data }: { data: ReceiptData }) {
  const { receipt } = data;
  return <>
    <PayoutFacts items={[
      { label: "Beneficiário", value: receipt.beneficiary.name },
      { label: "Pagamento em", value: formatDay(receipt.occurredOn) },
      { label: "Emitido por", value: `${receipt.issuer.name} · ${new Date(receipt.issuedAt).toLocaleString("pt-BR")}` },
      ...(receipt.branchName ? [{ label: "Unidade", value: receipt.branchName }] : []),
      { label: "Total pago", value: formatCents(receipt.netCents) },
      ...(data.reversedCents > 0 ? [{ label: "Estornado depois da emissão", value: formatCents(data.reversedCents) }] : []),
    ]} />
    {data.reversedCents > 0
      ? <ErpNote>Estornado depois da emissão: {formatCents(data.reversedCents)}. O recibo continua como foi emitido.</ErpNote>
      : null}
  </>;
}

export function ReceiptPrintButton() {
  return <Button type="button" className="print:hidden" onClick={() => window.print()}>Imprimir</Button>;
}

/** Printable receipt (immutable snapshot). */
export function ReceiptView({ data }: { data: ReceiptData }) {
  const { receipt } = data;
  const columns: ErpColumn<ReceiptItem>[] = [
    { id: "reference", label: "Comissão", primary: true, render: (item) => item.reference },
    { id: "description", label: "Descrição", secondary: true, render: (item) => item.description },
    { id: "amount", label: "Valor", numeric: true, render: (item) => formatCents(item.amountCents) },
    { id: "before", label: "Liquidado antes", numeric: true, render: (item) => formatCents(item.previouslySettledCents) },
    { id: "offset", label: "Compensado", numeric: true, render: (item) => formatCents(item.offsetCents) },
    { id: "paid", label: "Pago neste recibo", numeric: true, render: (item) => formatCents(item.paidCents) },
  ];
  return <>
    <ErpSection title={`Recibo de repasse ${receipt.number}`} description={`Competência ${receipt.competence}`}>
      <ReceiptFacts data={data} />
    </ErpSection>
    <ErpList title="Itens pagos" columns={columns} rows={receipt.items} rowKey={(item) => item.entryId}
      emptyTitle="Recibo sem itens" emptyText="Este recibo não registrou itens." />
    <ErpNote>
      Documento interno de conferência do repasse. Não é comprovante bancário nem nota fiscal. {IMMUTABLE_NOTE} Código de integridade: {data.digest.slice(0, 16)}.
    </ErpNote>
  </>;
}
