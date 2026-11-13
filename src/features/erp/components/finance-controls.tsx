"use client";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { SearchAddList, type SearchAddItem } from "@/components/ui/search-add-list";
import { formatCents } from "../contracts";
import { prepareClosingAction, prepareOffsetAction, reviewClosingAction, reviewOffsetAction, reverseOffsetAction } from "../finance-actions";
import type { getOffsets } from "../offsets";
import type { getClosings } from "../closing";
import { ErpList, ErpNote, ErpPager, ErpPanel, ErpRowMenu, type ErpColumn, type ErpMenuItem } from "../ui/erp-kit";
import { FORM_STACK, FinanceFeedback, formatDate, useFinanceAction } from "./finance-workspace";

type Offsets = Awaited<ReturnType<typeof getOffsets>>;
type OffsetRow = Offsets["rows"][number];
type OffsetChoice = Offsets["choices"][number];
type Closings = Awaited<ReturnType<typeof getClosings>>;
type ClosingRow = Closings["rows"][number];
type BadgeVariant = "secondary" | "outline" | "destructive";

/** Keeps clicks on the row menu (and its portaled items) from also opening the row. */
function stopRow(event: MouseEvent) {
  event.stopPropagation();
}

const OFFSET_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: "A conferir", variant: "outline" },
  confirmed: { label: "Confirmada", variant: "secondary" },
  rejected: { label: "Rejeitada", variant: "destructive" },
};
function OffsetStatusBadge({ status }: { status: string }) {
  const value = OFFSET_STATUS[status] ?? OFFSET_STATUS.pending;
  return <Badge variant={value.variant}>{value.label}</Badge>;
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

/** Primary CTA of the advances screen: opens the offset preparation in a drawer. */
export function OffsetPrepareButton({ data }: { data: Offsets }) {
  const router = useRouter();
  const [open, setOpen] = useState(0);
  if (!data.canPrepare) return null;
  return <>
    <Button type="button" onClick={() => setOpen((value) => value + 1)}>Preparar compensação</Button>
    <ErpPanel open={open > 0} onOpenChange={(next) => { if (!next) setOpen(0); }} title="Preparar compensação"
      description="Usa o saldo comprovado do adiantamento para reduzir o valor a repassar, sem uma segunda saída.">
      <OffsetPreparationForm key={open} choices={data.choices} onDone={() => router.refresh()} />
    </ErpPanel>
  </>;
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
  const menu = (item: OffsetRow): ErpMenuItem[] => [
    ...(item.canReview ? [{ id: "review", label: "Conferir compensação", onSelect: () => setOpenId(item.id) }] : []),
    ...(canReverseOffset(data, item) ? [{ id: "reverse", label: "Solicitar estorno", onSelect: () => setOpenId(item.id) }] : []),
    { id: "advance", label: "Ver adiantamento", href: `/financeiro/lancamentos/${item.advanceEntryId}` },
    { id: "commission", label: "Ver comissão", href: `/financeiro/lancamentos/${item.commissionEntryId}` },
  ];
  const columns: ErpColumn<OffsetRow>[] = [
    { id: "commission", label: "Comissão", primary: true, render: (item) => item.commissionReference },
    { id: "advance", label: "Adiantamento", secondary: true, render: (item) => item.advanceReference ?? "Não informado" },
    { id: "kind", label: "Tipo", render: (item) => offsetLabel(item) },
    { id: "date", label: "Data", nowrap: true, render: (item) => formatDate(item.occurredOn) },
    { id: "amount", label: "Valor", numeric: true, render: (item) => formatCents(item.amountCents) },
    { id: "status", label: "Estado", render: (item) => <OffsetStatusBadge status={item.status} /> },
    { id: "actions", label: "Ações", render: (item) => <div onClick={stopRow}>
      <ErpRowMenu label={`Ações da ${offsetLabel(item).toLowerCase()}`} items={menu(item)} /></div> },
  ];
  return <>
    <ErpList<OffsetRow>
      title="Compensações"
      description="Adiantamento usado para reduzir a comissão a repassar."
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
          <div><dt className="text-xs text-muted-foreground">Adiantamento</dt><dd className="text-sm">{row.advanceReference ?? "Não informado"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Comissão</dt><dd className="text-sm">{row.commissionReference}</dd></div>
        </dl>
        {row.reason ? <ErpNote>{row.reason}</ErpNote> : null}
        {row.canReview ? <OffsetReviewForm key={row.id} id={row.id} onDone={done} /> : null}
        {canReverseOffset(data, row) ? <OffsetReversalForm key={row.id} id={row.id} onDone={done} /> : null}
      </> : null}
    </ErpPanel>
  </>;
}

const CLOSING_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Aguardando aprovação", variant: "outline" },
  closed: { label: "Fechado", variant: "secondary" },
  reopened: { label: "Reaberto", variant: "outline" },
};
function ClosingStatusBadge({ status }: { status: string }) {
  const value = CLOSING_STATUS[status] ?? CLOSING_STATUS.pending;
  return <Badge variant={value.variant}>{value.label}</Badge>;
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
      <Input id={`${prefix}-competence`} name="competence" type="month" required disabled={pending} /></Field>}
    <Field><FieldLabel htmlFor={`${prefix}-reason`}>Motivo e parecer</FieldLabel>
      <Textarea id={`${prefix}-reason`} name="reason" required minLength={5} maxLength={300} disabled={pending} /></Field>
    <FinanceFeedback result={state} />
    <div><Button type="submit" variant={primary ? "default" : "outline"} loading={pending}>{CLOSING_SUBMIT[mode]}</Button></div>
  </form>;
}

/** Closings: one list (row → drawer with the snapshot and the close/reopen form); "Preparar competência" is the primary CTA. */
export function ClosingsWorkspace({ data }: { data: Closings }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(0);
  const row = data.rows.find((item) => item.id === openId) ?? null;
  const done = () => {
    setOpenId(null);
    setPreparing(0);
    router.refresh();
  };
  const columns: ErpColumn<ClosingRow>[] = [
    { id: "competence", label: "Competência", primary: true, render: (item) => item.competence },
    { id: "status", label: "Estado", secondary: true, render: (item) => <ClosingStatusBadge status={item.status} /> },
    { id: "in", label: "Entradas de caixa", numeric: true, render: (item) => formatCents(item.snapshot.cashInCents) },
    { id: "out", label: "Saídas de caixa", numeric: true, render: (item) => formatCents(item.snapshot.cashOutCents) },
    { id: "version", label: "Versão", numeric: true, render: (item) => item.version },
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
      actions={data.canPrepare ? <Button type="button" onClick={() => setPreparing((value) => value + 1)}>Preparar competência</Button> : undefined}
      columns={columns}
      rows={data.rows}
      rowKey={(item) => item.id}
      onRowOpen={(item) => setOpenId(item.id)}
      emptyTitle="Nenhuma conferência de fechamento"
      emptyText="Prepare a prévia de uma competência para iniciar a conferência."
    />
    <ErpPanel open={row !== null} onOpenChange={(open) => { if (!open) setOpenId(null); }}
      title={row ? `Competência ${row.competence}` : "Competência"} description={row ? `Versão ${row.version}` : undefined}>
      {row ? <>
        <div><ClosingStatusBadge status={row.status} /></div>
        <dl className="grid grid-cols-2 gap-3">{facts.map((fact) => <div key={fact.label}>
          <dt className="text-xs text-muted-foreground">{fact.label}</dt><dd className="text-sm font-semibold tabular-nums">{fact.value}</dd></div>)}</dl>
        <ErpNote>Prévia calculada em {new Date(row.snapshot.calculatedAt).toLocaleString("pt-BR")}.</ErpNote>
        {row.reason ? <ErpNote>{row.reason}</ErpNote> : null}
        {reopen ? <ClosingForm key={`${row.id}-reopen`} competence={row.competence} version={row.version} mode="reopen" primary={false} onDone={done} /> : null}
        {close ? <ClosingForm key={`${row.id}-close`} competence={row.competence} version={row.version} mode="close" primary onDone={done} /> : null}
        {reprepare ? <ClosingForm key={`${row.id}-prepare`} competence={row.competence} version={row.version} mode="prepare" primary={false} onDone={done} /> : null}
      </> : null}
    </ErpPanel>
    {data.canPrepare ? <ErpPanel open={preparing > 0} onOpenChange={(open) => { if (!open) setPreparing(0); }} title="Preparar competência"
      description="Calcula a memória dos fatos do mês para conferência independente.">
      <ClosingForm key={preparing} version={0} mode="prepare" primary onDone={done} />
    </ErpPanel> : null}
  </>;
}
