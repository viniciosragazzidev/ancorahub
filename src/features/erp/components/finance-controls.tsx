"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { SearchAddList, type SearchAddItem } from "@/components/ui/search-add-list";
import { formatCents } from "../contracts";
import { prepareClosingAction, prepareOffsetAction, reviewClosingAction, reviewOffsetAction, reverseOffsetAction } from "../finance-actions";
import type { getOffsets } from "../offsets";
import type { getClosings } from "../closing";
import { ErpCell, ErpList, ErpMonthField, ErpNote, ErpPager, ErpPanel, ErpStatus, useUrlPanel, type ErpColumn, type ErpTone } from "../ui/erp-kit";
import { formatCompetence, formatInstant } from "../ui/format";
import { FORM_STACK, FinanceFeedback, formatDate, useFinanceAction } from "./finance-workspace";

type Offsets = Awaited<ReturnType<typeof getOffsets>>;
type OffsetRow = Offsets["rows"][number];
type OffsetChoice = Offsets["choices"][number];
type Closings = Awaited<ReturnType<typeof getClosings>>;
type ClosingRow = Closings["rows"][number];

const OFFSET_STATUS: Record<string, { label: string; tone: ErpTone }> = {
  pending: { label: "A conferir", tone: "warning" },
  confirmed: { label: "Confirmada", tone: "success" },
  rejected: { label: "Rejeitada", tone: "danger" },
};
function OffsetStatusBadge({ status }: { status: string }) {
  const value = OFFSET_STATUS[status] ?? OFFSET_STATUS.pending;
  return <ErpStatus tone={value.tone}>{value.label}</ErpStatus>;
}

/** Choice from a bounded, already loaded list: search + "+", then the chosen one with "Trocar". */
function ChoicePick({ name, placeholder, choices, value, onChange }: {
  name: string; placeholder: string; choices: OffsetChoice[]; value: OffsetChoice | null; onChange: (choice: OffsetChoice | null) => void;
}) {
  if (value) {
    return <div className="flex items-center justify-between gap-2">
      <input type="hidden" name={name} value={value.id} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{value.reference}</p>
        <p className="truncate text-xs text-muted-foreground">{value.beneficiaryName ?? "Sem beneficiário"} · saldo {formatCents(value.availableCents)}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>Trocar</Button>
    </div>;
  }
  const items: SearchAddItem[] = choices.map((choice) => ({
    id: choice.id, label: choice.reference, keywords: choice.beneficiaryName ?? "",
    hint: `${choice.beneficiaryName ?? "Sem beneficiário"} · saldo ${formatCents(choice.availableCents)}`,
  }));
  return <><input type="hidden" name={name} value="" />
    <SearchAddList items={items} placeholder={placeholder} emptyLabel="Nada com saldo disponível no seu escopo."
      onAdd={(item) => onChange(choices.find((choice) => choice.id === item.id) ?? null)} /></>;
}

function OffsetPreparationForm({ choices, onDone }: { choices: OffsetChoice[]; onDone: () => void }) {
  const [state, action, pending] = useFinanceAction(prepareOffsetAction, onDone);
  const [requestId] = useState(() => crypto.randomUUID());
  const [advance, setAdvance] = useState<OffsetChoice | null>(null);
  const [commission, setCommission] = useState<OffsetChoice | null>(null);
  const advances = choices.filter((row) => row.kind === "advance");
  const commissions = choices.filter((row) => row.kind === "broker_commission" && (!advance || row.beneficiaryId === advance.beneficiaryId));
  function pickAdvance(choice: OffsetChoice | null) {
    setAdvance(choice);
    if (choice && commission && commission.beneficiaryId !== choice.beneficiaryId) setCommission(null);
  }
  return <form action={action} className={FORM_STACK}>
    <input type="hidden" name="requestId" value={requestId} />
    <Field><FieldLabel>Adiantamento concedido</FieldLabel>
      <ChoicePick name="advanceEntryId" placeholder="Buscar adiantamento ou beneficiário" choices={advances} value={advance} onChange={pickAdvance} /></Field>
    <Field><FieldLabel>Comissão a compensar</FieldLabel>
      <ChoicePick name="commissionEntryId" placeholder="Buscar comissão do mesmo beneficiário" choices={commissions} value={commission}
        onChange={setCommission} /></Field>
    <Field><FieldLabel htmlFor="offset-amount">Valor conferido (R$)</FieldLabel>
      <Input id="offset-amount" name="amount" inputMode="decimal" required disabled={pending} /></Field>
    <Field><FieldLabel htmlFor="offset-date">Data da compensação</FieldLabel>
      <Input id="offset-date" name="occurredOn" type="date" required disabled={pending} /></Field>
    <Field><FieldLabel htmlFor="offset-reason">Motivo e autorização conferida</FieldLabel>
      <Textarea id="offset-reason" name="reason" required minLength={5} maxLength={300} disabled={pending} /></Field>
    <ErpNote>Só aparecem adiantamentos com saldo comprovado e comissões aprovadas com saldo, fora de repasse em andamento.</ErpNote>
    <FinanceFeedback result={state} />
    <div><Button type="submit" loading={pending}>Preparar compensação</Button></div>
  </form>;
}

/** Offset preparation drawer, opened by the header CTA (`?compensar=1`). */
export function OffsetPreparePanel({ data }: { data: Offsets }) {
  const router = useRouter();
  const panel = useUrlPanel("compensar");
  if (!data.canPrepare) return null;
  return <ErpPanel open={panel.open} onOpenChange={(next) => { if (!next) panel.close(); }} title="Preparar compensação"
    description="Usa o saldo comprovado do adiantamento para reduzir o valor a repassar, sem uma segunda saída.">
    {panel.open ? <OffsetPreparationForm choices={data.choices} onDone={() => { panel.close(); router.refresh(); }} /> : null}
  </ErpPanel>;
}

function OffsetReviewForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [state, action, pending] = useFinanceAction(reviewOffsetAction, onDone);
  return <form action={action} className={FORM_STACK}>
    <input type="hidden" name="id" value={id} />
    <Field><FieldLabel htmlFor={`offset-review-${id}`}>Motivo da revisão</FieldLabel>
      <Textarea id={`offset-review-${id}`} name="reason" required minLength={5} maxLength={300} disabled={pending} /></Field>
    <FinanceFeedback result={state} />
    <div className="flex flex-wrap gap-2">
      <Button type="submit" name="decision" value="confirm" disabled={pending}>Confirmar compensação</Button>
      <Button type="submit" name="decision" value="reject" variant="outline" disabled={pending}>Rejeitar</Button>
    </div>
  </form>;
}
function OffsetReversalForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [state, action, pending] = useFinanceAction(reverseOffsetAction, onDone);
  const [requestId] = useState(() => crypto.randomUUID());
  return <form action={action} className={FORM_STACK}>
    <input type="hidden" name="id" value={id} /><input type="hidden" name="requestId" value={requestId} />
    <Field><FieldLabel htmlFor={`offset-reversal-date-${id}`}>Data do estorno</FieldLabel>
      <Input id={`offset-reversal-date-${id}`} name="occurredOn" type="date" required disabled={pending} /></Field>
    <Field><FieldLabel htmlFor={`offset-reversal-reason-${id}`}>Motivo do estorno</FieldLabel>
      <Textarea id={`offset-reversal-reason-${id}`} name="reason" required minLength={5} maxLength={300} disabled={pending} /></Field>
    <FinanceFeedback result={state} />
    <div><Button type="submit" variant="outline" loading={pending}>Preparar estorno</Button></div>
  </form>;
}

function canReverseOffset(data: Offsets, row: OffsetRow) {
  return data.canPrepare && row.kind === "allocation" && row.status === "confirmed";
}
const offsetLabelHeader = "Compensação";
function offsetLabel(row: OffsetRow) {
  return row.kind === "reversal" ? "Estorno" : "Compensação";
}

/** Offsets list: row → drawer with the summary and the one form that applies (review when pending, reversal when confirmed). */
export function OffsetsList({ data }: { data: Offsets }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const row = data.rows.find((item) => item.id === openId) ?? null;
  const done = () => {
    setOpenId(null);
    router.refresh();
  };
  const columns: ErpColumn<OffsetRow>[] = [
    { id: "commission", label: offsetLabelHeader, primary: true, render: (item) => <ErpCell title={`${offsetLabel(item)} da comissão ${item.commissionReference}`}
      sub={`Adiantamento ${item.advanceReference ?? "não informado"}`} /> },
    { id: "date", label: "Data", nowrap: true, render: (item) => formatDate(item.occurredOn) },
    { id: "amount", label: "Valor", numeric: true, render: (item) => formatCents(item.amountCents) },
    { id: "status", label: "Estado", render: (item) => <OffsetStatusBadge status={item.status} /> },
  ];
  return <>
    <ErpList<OffsetRow>
      title="Compensações"
      count={data.total}
      countLabel={["compensação", "compensações"]}
      columns={columns}
      rows={data.rows}
      rowKey={(item) => item.id}
      onRowOpen={(item) => setOpenId(item.id)}
      emptyTitle="Nenhuma compensação registrada"
      emptyText="Nenhuma compensação foi preparada no seu escopo."
      footer={<ErpPager page={data.page} total={data.total} pageSize={data.pageSize} label="Paginação das compensações" />}
    />
    <ErpPanel open={row !== null} onOpenChange={(open) => { if (!open) setOpenId(null); }}
      title={row ? `${offsetLabel(row)} · ${formatCents(row.amountCents)}` : "Compensação"} description={row ? formatDate(row.occurredOn) : undefined}>
      {row ? <>
        <div><OffsetStatusBadge status={row.status} /></div>
        <dl className="grid grid-cols-2 gap-3">
          <div><dt className="text-xs text-muted-foreground">Adiantamento</dt><dd className="text-sm">
            <Link className="underline-offset-4 hover:underline" href={`/financeiro/lancamentos/${row.advanceEntryId}`}>{row.advanceReference ?? "Não informado"}</Link></dd></div>
          <div><dt className="text-xs text-muted-foreground">Comissão</dt><dd className="text-sm">
            <Link className="underline-offset-4 hover:underline" href={`/financeiro/lancamentos/${row.commissionEntryId}`}>{row.commissionReference}</Link></dd></div>
        </dl>
        {row.reason ? <ErpNote>{row.reason}</ErpNote> : null}
        {row.canReview ? <OffsetReviewForm key={row.id} id={row.id} onDone={done} /> : null}
        {canReverseOffset(data, row) ? <OffsetReversalForm key={row.id} id={row.id} onDone={done} /> : null}
      </> : null}
    </ErpPanel>
  </>;
}

const CLOSING_STATUS: Record<string, { label: string; tone: ErpTone }> = {
  pending: { label: "Aguardando aprovação", tone: "warning" },
  closed: { label: "Fechado", tone: "success" },
  reopened: { label: "Reaberto", tone: "info" },
};
function ClosingStatusBadge({ status }: { status: string }) {
  const value = CLOSING_STATUS[status] ?? CLOSING_STATUS.pending;
  return <ErpStatus tone={value.tone}>{value.label}</ErpStatus>;
}

type ClosingMode = "prepare" | "close" | "reopen";
const CLOSING_SUBMIT: Record<ClosingMode, string> = {
  prepare: "Preparar prévia", close: "Aprovar e fechar período", reopen: "Reabrir período com motivo",
};
function ClosingForm({ competence, version, mode, primary, onDone }: {
  competence?: string; version: number; mode: ClosingMode; primary: boolean; onDone: () => void;
}) {
  const [state, action, pending] = useFinanceAction(mode === "prepare" ? prepareClosingAction : reviewClosingAction, onDone);
  const prefix = `closing-${mode}-${competence ?? "new"}`;
  return <form action={action} className={FORM_STACK}>
    <input type="hidden" name="version" value={version} /><input type="hidden" name="decision" value={mode} />
    {competence ? <input type="hidden" name="competence" value={competence} /> : <Field>
      <FieldLabel htmlFor={`${prefix}-competence`}>Competência</FieldLabel>
      <ErpMonthField id={`${prefix}-competence`} name="competence" after={0} disabled={pending} /></Field>}
    <Field><FieldLabel htmlFor={`${prefix}-reason`}>Motivo e parecer</FieldLabel>
      <Textarea id={`${prefix}-reason`} name="reason" required minLength={5} maxLength={300} disabled={pending} /></Field>
    <FinanceFeedback result={state} />
    <div><Button type="submit" variant={primary ? "default" : "outline"} loading={pending}>{CLOSING_SUBMIT[mode]}</Button></div>
  </form>;
}

/**
 * Closings: one list (row → drawer with the snapshot and the close/reopen form). The page header owns
 * "Preparar competência" (`?preparar=1`).
 */
export function ClosingsWorkspace({ data }: { data: Closings }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const preparing = useUrlPanel("preparar");
  const row = data.rows.find((item) => item.id === openId) ?? null;
  const done = () => {
    setOpenId(null);
    preparing.close();
    router.refresh();
  };
  const columns: ErpColumn<ClosingRow>[] = [
    { id: "competence", label: "Competência", primary: true, render: (item) => <ErpCell title={formatCompetence(item.competence, "long").replace(/^./, (letter) => letter.toUpperCase())}
      sub={`Versão ${item.version} · prévia de ${formatInstant(item.snapshot.calculatedAt)}`} /> },
    { id: "status", label: "Estado", render: (item) => <ClosingStatusBadge status={item.status} /> },
    { id: "in", label: "Entradas de caixa", numeric: true, render: (item) => formatCents(item.snapshot.cashInCents) },
    { id: "out", label: "Saídas de caixa", numeric: true, render: (item) => formatCents(item.snapshot.cashOutCents) },
  ];
  const facts = row ? [
    { label: "Lançamentos", value: String(row.snapshot.entryCount) },
    { label: "Movimentos", value: String(row.snapshot.movementCount) },
    { label: "Compensações", value: String(row.snapshot.offsetCount) },
    { label: "Entradas de caixa", value: formatCents(row.snapshot.cashInCents) },
    { label: "Saídas de caixa", value: formatCents(row.snapshot.cashOutCents) },
    { label: "Fora do caixa", value: formatCents(row.snapshot.externalCents) },
  ] : [];
  const reopen = row?.status === "closed" && row.canReopen;
  const close = row?.status === "pending" && row.canReview;
  const reprepare = row && row.status !== "closed" && data.canPrepare;
  return <>
    <ErpList<ClosingRow>
      title="Competências"
      description="Últimas 36 competências preparadas."
      count={data.rows.length}
      countLabel={["competência", "competências"]}
      columns={columns}
      rows={data.rows}
      rowKey={(item) => item.id}
      onRowOpen={(item) => setOpenId(item.id)}
      emptyTitle="Nenhuma conferência de fechamento"
      emptyText="Prepare a prévia de uma competência para iniciar a conferência."
    />
    <ErpPanel open={row !== null} onOpenChange={(open) => { if (!open) setOpenId(null); }}
      title={row ? `Competência de ${formatCompetence(row.competence, "long")}` : "Competência"} description={row ? `Versão ${row.version}` : undefined}>
      {row ? <>
        <div><ClosingStatusBadge status={row.status} /></div>
        <dl className="grid grid-cols-2 gap-3">{facts.map((fact) => <div key={fact.label}>
          <dt className="text-xs text-muted-foreground">{fact.label}</dt><dd className="text-sm font-semibold tabular-nums">{fact.value}</dd></div>)}</dl>
        <ErpNote>Prévia calculada em {formatInstant(row.snapshot.calculatedAt)}.</ErpNote>
        {row.reason ? <ErpNote>{row.reason}</ErpNote> : null}
        {reopen ? <ClosingForm key={`${row.id}-reopen`} competence={row.competence} version={row.version} mode="reopen" primary={false} onDone={done} /> : null}
        {close ? <ClosingForm key={`${row.id}-close`} competence={row.competence} version={row.version} mode="close" primary onDone={done} /> : null}
        {reprepare ? <ClosingForm key={`${row.id}-prepare`} competence={row.competence} version={row.version} mode="prepare" primary={false} onDone={done} /> : null}
      </> : null}
    </ErpPanel>
    {data.canPrepare ? <ErpPanel open={preparing.open} onOpenChange={(open) => { if (!open) preparing.close(); }} title="Preparar competência"
      description="Calcula a memória dos fatos do mês para conferência independente.">
      {preparing.open ? <ClosingForm version={0} mode="prepare" primary onDone={done} /> : null}
    </ErpPanel> : null}
  </>;
}

type CashKind = { kind: string; cents: number; count: number; incoming: boolean };
const CASH_KIND_LABELS: Record<string, string> = {
  agency_receivable: "Recebíveis da corretora", broker_commission: "Comissões pagas", expense: "Despesas pagas", advance: "Adiantamentos concedidos",
};

/** Cash of the month by type: one table, entries first; the empty state says what "no movement" means. */
export function CashKindsList({ rows, monthLabel }: { rows: CashKind[]; monthLabel: string }) {
  const sorted = [...rows].sort((left, right) => Number(right.incoming) - Number(left.incoming) || right.cents - left.cents);
  const columns: ErpColumn<CashKind>[] = [
    { id: "kind", label: "Tipo", primary: true, render: (row) => <ErpCell title={CASH_KIND_LABELS[row.kind] ?? row.kind} sub={`${row.count} movimento(s) confirmado(s)`} /> },
    { id: "direction", label: "Sentido", render: (row) => <ErpStatus tone={row.incoming ? "success" : "warning"}>{row.incoming ? "Entrada" : "Saída"}</ErpStatus> },
    { id: "cents", label: "Valor", numeric: true, render: (row) => formatCents(row.cents) },
  ];
  return <ErpList title={`Movimentos de ${monthLabel}`} count={rows.reduce((total, row) => total + row.count, 0)} countLabel={["movimento", "movimentos"]}
    columns={columns} rows={sorted} rowKey={(row) => row.kind}
    emptyTitle="Nenhum movimento confirmado neste mês"
    emptyText="Só liquidações confirmadas entram no caixa. Um valor ainda não conferido não aparece aqui e não é inadimplência." />;
}
