"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCents, type ErpActionResult } from "../contracts";
import { bringScheduleAction } from "../commission-actions";
import { ENTRY_STATUS_LABELS } from "../shared";
import type { getCommissionOverview } from "../commissions";
import { ErpList, ErpMonthFilter, ErpNote, ErpPager, ErpPanel, ErpRowMenu, ErpToolbar, type ErpColumn, type ErpMenuItem } from "../ui/erp-kit";
import { FinanceFeedback } from "./finance-workspace";
import { PayoutFacts, StopRowOpen } from "./payout-parts";

type Overview = Awaited<ReturnType<typeof getCommissionOverview>>;
type CommissionRow = Overview["rows"][number];

const INITIAL: ErpActionResult = { ok: true, message: "" };
const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  cancelled: "Cancelado",
  chargeback_pending: "Revisão de estorno",
};

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
    description={row ? `${row.monthNumber}ª parcela · competência ${row.referenceMonth}` : undefined}>
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

export function CommissionsList({ data }: { data: Overview }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = data.rows.find((row) => row.id === openId) ?? null;
  const menu = (row: CommissionRow): ErpMenuItem[] => [
    { id: "details", label: "Ver detalhes", onSelect: () => setOpenId(row.id) },
    ...(row.entry ? [{ id: "entry", label: "Abrir lançamento", href: `/financeiro/lancamentos/${row.entry.id}` }] : []),
    ...(canBringRow(data, row) ? [{ id: "bring", label: "Conferir no ERP", onSelect: () => setOpenId(row.id) }] : []),
  ];
  const columns: ErpColumn<CommissionRow>[] = [
    { id: "sale", label: "Venda", primary: true, render: (row) => row.clientName },
    { id: "broker", label: "Corretor", secondary: true, nowrap: true,
      render: (row) => `${row.brokerName ?? "Corretor"}${row.saleStatus !== "active" ? " · venda cancelada" : ""}` },
    { id: "installment", label: "Parcela", render: (row) => `${row.monthNumber}ª · ${row.referenceMonth} · ${row.percentage}%` },
    { id: "expected", label: "Previsto", numeric: true, render: (row) => formatCents(row.expectedCents) },
    { id: "schedule", label: "Cronograma",
      render: (row) => <Badge variant={row.legacyStatus === "paid" ? "success" : "outline"}>{SCHEDULE_STATUS_LABELS[row.legacyStatus] ?? row.legacyStatus}</Badge> },
    { id: "conference", label: "Conferência", render: (row) => row.entry
      ? <span className="flex flex-wrap items-center gap-1">{entryLabel(row.entry.status)} · {formatCents(row.entry.amountCents)}
        {row.divergence ? <Badge variant="secondary">Divergência</Badge> : null}</span>
      : "Não conferida" },
    { id: "paid", label: "Pago ao corretor", numeric: true,
      render: (row) => row.entry ? `${formatCents(row.paidCents)}${row.offsetCents ? ` + ${formatCents(row.offsetCents)} compensado` : ""}` : "—" },
    { id: "menu", label: "Ações", render: (row) => <StopRowOpen><ErpRowMenu label={`Ações da parcela de ${row.clientName}`} items={menu(row)} /></StopRowOpen> },
  ];
  return <>
    <ErpNote>
      Previsto vem do cronograma da venda. Conferido é o valor aprovado com evidência no ERP. Pago ao corretor é a soma das liquidações e
      compensações confirmadas. São três fatos diferentes.
    </ErpNote>
    <ErpToolbar><ErpMonthFilter value={data.filters.competence ?? ""} /></ErpToolbar>
    <ErpList title={data.agency ? "Parcelas de comissão" : "Minhas parcelas"} columns={columns} rows={data.rows} rowKey={(row) => row.id}
      onRowOpen={(row) => setOpenId(row.id)} emptyTitle="Nenhuma parcela de comissão neste filtro"
      emptyText="As parcelas nascem do cronograma da venda registrada. Sem cronograma, não há valor previsto."
      footer={<ErpPager page={data.filters.page} total={data.total} pageSize={data.pageSize} label="Paginação de comissões" />} />
    <CommissionPanel data={data} row={open} onClose={() => setOpenId(null)} />
  </>;
}
