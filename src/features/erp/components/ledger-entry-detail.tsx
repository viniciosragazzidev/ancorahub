"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/metric-card";
import { FINANCIAL_LABELS, formatCents } from "../contracts";
import { ErpList, ErpNote, ErpPanel, ErpSection, ErpStats, ErpStatus, type ErpColumn } from "../ui/erp-kit";
import { formatCompetence } from "../ui/format";
import {
  EntryStatusBadge, EvidenceBlock, MovementForm, MovementStatusBadge, ReviewBlock, SettlementBlock, entryBlocks, formatDate, movementLabel,
  type EntryDetail, type EntryMovement,
} from "./finance-workspace";

/** Full record of an entry: summary KPIs, evidence, review, settlement and the movements list (row → drawer). */
export function FinancialEntryDetail({ detail }: { detail: EntryDetail }) {
  const router = useRouter();
  const [movementId, setMovementId] = useState<string | null>(null);
  const movement = detail.movements.find((row) => row.id === movementId) ?? null;
  const blocks = entryBlocks(detail);
  const refresh = () => router.refresh();
  const columns: ErpColumn<EntryMovement>[] = [
    { id: "kind", label: "Movimento", primary: true, render: (row) => movementLabel(row) },
    { id: "date", label: "Data", nowrap: true, secondary: true, render: (row) => formatDate(row.occurredOn) },
    { id: "amount", label: "Valor", numeric: true, render: (row) => formatCents(row.amountCents) },
    { id: "status", label: "Estado", render: (row) => <MovementStatusBadge status={row.status} /> },
  ];
  return <>
    <div className="flex flex-wrap items-center gap-2">
      <EntryStatusBadge status={detail.entry.status} />
      <ErpStatus>{FINANCIAL_LABELS[detail.entry.kind]}</ErpStatus>
      <ErpNote>Ref. {detail.entry.reference} · {formatCompetence(detail.entry.competence, "long")} · vencimento {formatDate(detail.entry.dueOn)}</ErpNote>
    </div>
    <ErpStats>
      <StatCard label="Conferido" value={formatCents(detail.entry.amountCents)} sublabel="valor aprovado ou a aprovar" />
      <StatCard label="Liquidado" value={formatCents(detail.settledCents)} sublabel="liquidações confirmadas" />
      <StatCard label="Saldo a liquidar" value={formatCents(detail.entry.amountCents - detail.settledCents)} sublabel="conferido menos liquidado" />
    </ErpStats>
    {blocks.evidence ? <ErpSection title="Evidências" description="Arquivos privados que comprovam o valor e as liquidações.">
      <EvidenceBlock detail={detail} onChanged={refresh} /></ErpSection> : null}
    {blocks.review ? <ErpSection title="Conferência independente" description="Outra pessoa autorizada aprova ou rejeita o valor conferido.">
      <ReviewBlock detail={detail} onChanged={refresh} /></ErpSection> : null}
    {blocks.settlement ? <ErpSection title="Registrar liquidação"><SettlementBlock detail={detail} onChanged={refresh} /></ErpSection> : null}
    <ErpList<EntryMovement>
      title="Liquidações e estornos"
      count={detail.movements.length}
      countLabel={["movimento", "movimentos"]}
      columns={columns}
      rows={detail.movements}
      rowKey={(row) => row.id}
      onRowOpen={(row) => setMovementId(row.id)}
      emptyTitle="Nenhuma liquidação registrada"
      emptyText="Uma liquidação ausente ainda não foi informada. Ela não representa inadimplência."
    />
    <ErpPanel open={movement !== null} onOpenChange={(open) => { if (!open) setMovementId(null); }}
      title={movement ? `${movementLabel(movement)} · ${formatCents(movement.amountCents)}` : "Movimento"}
      description={movement ? `${formatDate(movement.occurredOn)}` : undefined}>
      {movement ? <>
        <div><MovementStatusBadge status={movement.status} /></div>
        {movement.reason ? <ErpNote>{movement.reason}</ErpNote> : null}
        {movement.evidenceDocumentId ? <div><Button variant="link" render={<a href={`/api/erp/documents/${movement.evidenceDocumentId}`} />}>Conferir evidência</Button></div> : null}
        <MovementForm key={movement.id} detail={detail} movement={movement} onChanged={() => { setMovementId(null); refresh(); }} />
      </> : null}
    </ErpPanel>
  </>;
}
