"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCents, type ErpActionResult } from "../contracts";
import { bringScheduleAction } from "../commission-actions";
import { ENTRY_STATUS_LABELS } from "../shared";
import type { getCommissionOverview } from "../commissions";
import { ErpCell, ErpList, ErpNote, ErpPager, ErpPanel, ErpStatus, type ErpColumn, type ErpTone } from "../ui/erp-kit";
import { formatCompetence } from "../ui/format";
import { FinanceFeedback } from "./finance-workspace";
import { PayoutFacts } from "./payout-parts";

type Overview = Awaited<ReturnType<typeof getCommissionOverview>>;
type CommissionRow = Overview["rows"][number];

const INITIAL: ErpActionResult = { ok: true, message: "" };
const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  cancelled: "Cancelado",
  chargeback_pending: "Revisão de estorno",
};

const SCHEDULE_TONE: Record<string, ErpTone> = { pending: "warning", paid: "success", cancelled: "danger", chargeback_pending: "danger" };
const ENTRY_TONE: Record<string, ErpTone> = { submitted: "warning", approved: "success", rejected: "danger" };

function entryLabel(status: string) {
  return ENTRY_STATUS_LABELS[status as keyof typeof ENTRY_STATUS_LABELS] ?? "A conferir";
}

/** A sale's pending installments can be brought to the ERP once, while nothing of it is in the ERP yet. */
function canBringRow(data: Overview, row: CommissionRow) {
  return data.canBring && row.saleStatus === "active" && row.legacyStatus === "pending" && !row.entry;
}

function BringScheduleForm({ saleId }: { saleId: string }) {
  const [state, action, pending] = useActionState(bringScheduleAction, INITIAL);
  return <form action={action} className="flex flex-col gap-2">
    <input type="hidden" name="saleId" value={saleId} />
    <ErpNote>Envia as parcelas pendentes desta venda para conferência. Depois anexe a evidência e peça a aprovação de outra pessoa.</ErpNote>
    <FinanceFeedback result={state} />
    <div><Button type="submit" loading={pending}>Conferir no ERP</Button></div>
  </form>;
}

function CommissionPanel({ data, row, onClose }: { data: Overview; row: CommissionRow | null; onClose: () => void }) {
  return <ErpPanel open={row !== null} onOpenChange={(open) => { if (!open) onClose(); }} title={row ? row.clientName : "Parcela"}
    description={row ? `${row.monthNumber}ª parcela · ${formatCompetence(row.referenceMonth, "long")}` : undefined}>
    {row ? <>
      <PayoutFacts items={[
        { label: "Corretor", value: row.brokerName ?? "Corretor" },
        { label: "Venda", value: row.saleStatus === "active" ? "Ativa" : "Cancelada" },
        { label: "Percentual", value: `${row.percentage}%` },
        { label: "Previsto no cronograma", value: formatCents(row.expectedCents) },
        { label: "Cronograma", value: SCHEDULE_STATUS_LABELS[row.legacyStatus] ?? row.legacyStatus },
      ]} />
      {row.entry ? <>
        <PayoutFacts items={[
          { label: "Lançamento no ERP", value: row.entry.reference },
          { label: "Conferência", value: entryLabel(row.entry.status) },
          { label: "Valor conferido", value: formatCents(row.entry.amountCents) },
          { label: "Pago ao corretor", value: formatCents(row.paidCents) },
          ...(row.offsetCents ? [{ label: "Compensado", value: formatCents(row.offsetCents) }] : []),
        ]} />
        {row.divergenceLabel ? <ErpNote>Divergência: {row.divergenceLabel}</ErpNote> : null}
        <div><Button variant="outline" render={<Link href={`/financeiro/lancamentos/${row.entry.id}`} />}>Abrir lançamento</Button></div>
      </> : <ErpNote>Esta parcela ainda não foi conferida no ERP. Sem conferência não há valor pago registrado.</ErpNote>}
      {canBringRow(data, row) ? <BringScheduleForm key={row.saleId} saleId={row.saleId} /> : null}
    </> : null}
  </ErpPanel>;
}

/**
 * Commission installments: previsto (schedule), conferido (ERP) and pago ao corretor side by side. The row opens the
 * drawer; "Conferir no ERP" lives there. Numbers, search and month are rendered by the page.
 */
export function CommissionsList({ data }: { data: Overview }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = data.rows.find((row) => row.id === openId) ?? null;
  const columns: ErpColumn<CommissionRow>[] = [
    { id: "sale", label: "Venda", primary: true, render: (row) => <ErpCell title={row.clientName}
      sub={`${row.brokerName ?? "Corretor"}${row.saleStatus !== "active" ? " · venda cancelada" : ""}`} /> },
    { id: "installment", label: "Parcela", nowrap: true, render: (row) => <ErpCell title={`${row.monthNumber}ª · ${formatCompetence(row.referenceMonth)}`} sub={`${row.percentage}%`} /> },
    { id: "expected", label: "Previsto", numeric: true, render: (row) => formatCents(row.expectedCents) },
    { id: "schedule", label: "Cronograma",
      render: (row) => <ErpStatus tone={SCHEDULE_TONE[row.legacyStatus] ?? "neutral"}>{SCHEDULE_STATUS_LABELS[row.legacyStatus] ?? row.legacyStatus}</ErpStatus> },
    { id: "conference", label: "Conferência", render: (row) => row.entry
      ? <span className="flex flex-wrap items-center gap-1"><ErpStatus tone={row.divergence ? "danger" : ENTRY_TONE[row.entry.status] ?? "neutral"}>
        {row.divergence ? "Divergência" : entryLabel(row.entry.status)}</ErpStatus></span>
      : <ErpStatus>Não conferida</ErpStatus> },
    { id: "paid", label: "Pago ao corretor", numeric: true,
      render: (row) => row.entry ? <ErpCell title={formatCents(row.paidCents)} sub={row.offsetCents ? `+ ${formatCents(row.offsetCents)} compensado` : undefined} /> : "Sem registro" },
  ];
  return <>
    <ErpList title={data.agency ? "Parcelas de comissão" : "Minhas parcelas"} count={data.total} countLabel={["parcela", "parcelas"]} columns={columns}
      rows={data.rows} rowKey={(row) => row.id}
      onRowOpen={(row) => setOpenId(row.id)} emptyTitle="Nenhuma parcela de comissão neste filtro"
      emptyText="As parcelas nascem do cronograma da venda registrada. Sem cronograma, não há valor previsto."
      footer={<ErpPager page={data.filters.page} total={data.total} pageSize={data.pageSize} label="Paginação de comissões" />} />
    <CommissionPanel data={data} row={open} onClose={() => setOpenId(null)} />
  </>;
}
