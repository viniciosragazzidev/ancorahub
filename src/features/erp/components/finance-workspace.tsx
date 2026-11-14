"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AppSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Field, FieldError, FieldLabel, FieldSuccess } from "@/components/ui/field";
import { FINANCIAL_KINDS, FINANCIAL_LABELS, formatCents, type ErpActionResult, type FinancialKind } from "../contracts";
import {
  loadFinancialEntryAction, prepareFinancialEntryAction, prepareSettlementAction, reverseSettlementAction, reviewFinancialEntryAction,
  reviewSettlementAction, searchFinanceBeneficiariesAction, searchFinanceSalesAction,
} from "../finance-actions";
import { submitErpFile } from "../client-file-request";
import { ENTRY_STATUS_LABELS, MOVEMENT_STATUS_LABELS } from "../shared";
import type { getFinancialEntries, getFinancialEntry, getFinanceSelectors, searchFinanceSales } from "../finance";
import { ErpCell, ErpList, ErpMonthField, ErpNote, ErpPager, ErpPanel, ErpRowMenu, ErpStatus, useUrlPanel, type ErpColumn, type ErpMenuItem, type ErpTone } from "../ui/erp-kit";
import { formatCompetence, formatDay } from "../ui/format";
import { ServerSearchPick, type PickedRecord } from "./ledger-search-pick";

export const INITIAL_RESULT: ErpActionResult = { ok: true, message: "" };
export const FORM_STACK = "flex flex-col gap-3";

export function FinanceFeedback({ result }: { result: ErpActionResult }) {
  if (!result.message) return null;
  return result.ok ? <FieldSuccess>{result.message}</FieldSuccess> : <FieldError>{result.message}</FieldError>;
}

const ENTRY_TONE: Record<string, ErpTone> = { submitted: "warning", approved: "success", rejected: "danger" };
const MOVEMENT_TONE: Record<string, ErpTone> = { pending: "warning", confirmed: "success", rejected: "danger" };

export function EntryStatusBadge({ status }: { status: string }) {
  const label = ENTRY_STATUS_LABELS[status as keyof typeof ENTRY_STATUS_LABELS] ?? "A conferir";
  return <ErpStatus tone={ENTRY_TONE[status] ?? "neutral"}>{label}</ErpStatus>;
}
export function MovementStatusBadge({ status }: { status: string }) {
  return <ErpStatus tone={MOVEMENT_TONE[status] ?? "neutral"}>{MOVEMENT_STATUS_LABELS[status] ?? "A conferir"}</ErpStatus>;
}
export function formatDate(value: string) {
  return formatDay(value);
}

export type EntryDetail = Awaited<ReturnType<typeof getFinancialEntry>>;
export type EntryMovement = EntryDetail["movements"][number];
type Branches = Awaited<ReturnType<typeof getFinanceSelectors>>["branches"];
type SaleRow = Awaited<ReturnType<typeof searchFinanceSales>>[number];
type BeneficiaryRow = { id: string; name: string };

const SALE_KINDS: readonly FinancialKind[] = ["client_premium", "agency_receivable", "broker_commission"];
const BENEFICIARY_KINDS: readonly FinancialKind[] = ["broker_commission", "advance"];

/** Preparation of a new entry. Sale and beneficiary come from server search; the entry opens afterwards to receive evidence. */
export function NewEntryForm({ branches, defaultKind, onCreated }: {
  branches: Branches; defaultKind: FinancialKind; onCreated: (id: string) => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [kind, setKind] = useState<FinancialKind>(defaultKind);
  const [sale, setSale] = useState<{ record: PickedRecord; row: SaleRow } | null>(null);
  const [beneficiary, setBeneficiary] = useState<PickedRecord | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState(INITIAL_RESULT);

  function pickSale(record: PickedRecord | null, row: SaleRow | null) {
    setSale(record && row ? { record, row } : null);
    if (kind === "broker_commission") setBeneficiary(row ? { id: row.brokerId, label: row.brokerName ?? "Corretor da venda" } : null);
  }
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const response = await prepareFinancialEntryAction(INITIAL_RESULT, form);
      setResult(response);
      if (response.ok && response.id) onCreated(response.id);
    });
  }
  const kindOptions = FINANCIAL_KINDS.map((value) => ({ value, label: FINANCIAL_LABELS[value] }));
  const branchOptions = [{ value: "", label: "Usar vínculo da venda ou beneficiário" }, ...branches.map((row) => ({ value: row.id, label: row.name }))];
  return <form onSubmit={prepare} className={FORM_STACK}>
    <input type="hidden" name="requestId" value={requestId} />
    <Field><FieldLabel htmlFor="finance-kind">Tipo de fato</FieldLabel>
      <AppSelect id="finance-kind" name="kind" value={kind} onValueChange={(value) => setKind(value as FinancialKind)} options={kindOptions} /></Field>
    <Field><FieldLabel htmlFor="finance-reference">Referência única</FieldLabel>
      <Input id="finance-reference" name="reference" required maxLength={100} /></Field>
    <Field><FieldLabel htmlFor="finance-description">Descrição</FieldLabel>
      <Input id="finance-description" name="description" required minLength={3} maxLength={180} /></Field>
    <Field><FieldLabel>Venda vinculada{SALE_KINDS.includes(kind) ? "" : " (opcional)"}</FieldLabel>
      <ServerSearchPick<SaleRow> name="saleId" label="Venda vinculada" placeholder="Buscar venda pelo nome do cliente"
        value={sale?.record ?? null} onChange={pickSale} search={searchFinanceSalesAction} disabled={pending}
        toRecord={(row) => ({ id: row.id, label: row.name, hint: row.brokerName ? `Corretor: ${row.brokerName}` : undefined })} /></Field>
    <Field><FieldLabel htmlFor="finance-branch">Unidade</FieldLabel>
      <AppSelect key={sale?.row.id ?? "none"} id="finance-branch" name="branchId" defaultValue={sale?.row.branchId ?? ""} options={branchOptions} /></Field>
    <Field><FieldLabel>Beneficiário interno{BENEFICIARY_KINDS.includes(kind) ? "" : " (opcional)"}</FieldLabel>
      <ServerSearchPick<BeneficiaryRow> name="beneficiaryId" label="Beneficiário interno" placeholder="Buscar pessoa pelo nome"
        value={beneficiary} onChange={(record) => setBeneficiary(record)} search={searchFinanceBeneficiariesAction} disabled={pending}
        toRecord={(row) => ({ id: row.id, label: row.name })} /></Field>
    <Field><FieldLabel htmlFor="finance-amount">Valor conferido (R$)</FieldLabel>
      <Input id="finance-amount" name="amount" inputMode="decimal" required placeholder="0,00" /></Field>
    <Field><FieldLabel htmlFor="finance-due">Vencimento</FieldLabel><Input id="finance-due" name="dueOn" type="date" required /></Field>
    <Field><FieldLabel htmlFor="finance-period">Competência</FieldLabel><ErpMonthField id="finance-period" name="competence" /></Field>
    {kind === "client_premium" ? <ErpNote>Pagamento do cliente à operadora. Este fato não movimenta o caixa da Âncora.</ErpNote> : null}
    {kind === "broker_commission" ? <ErpNote>A comissão pertence ao corretor da venda.</ErpNote> : null}
    <FinanceFeedback result={result} />
    <div><Button type="submit" loading={pending}>Preparar e enviar evidência</Button></div>
  </form>;
}

function EvidenceUpload({ detail, onChanged }: { detail: EntryDetail; onChanged: () => void }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState(INITIAL_RESULT);
  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    form.set("module", "finance");
    form.set("entryId", detail.entry.id);
    startTransition(async () => {
      const response = await submitErpFile("/api/erp/evidence", form);
      setResult(response);
      if (response.ok) {
        element.reset();
        onChanged();
      }
    });
  }
  return <form onSubmit={upload} className={FORM_STACK}>
    <Field><FieldLabel htmlFor={`evidence-${detail.entry.id}`}>Enviar evidência privada (PDF, PNG ou JPEG)</FieldLabel>
      <Input id={`evidence-${detail.entry.id}`} name="file" type="file" accept="application/pdf,image/png,image/jpeg" required disabled={pending} /></Field>
    <FinanceFeedback result={result} />
    <div><Button type="submit" variant="outline" loading={pending}>Enviar evidência</Button></div>
  </form>;
}

/** Wraps a server action so a successful result also reloads the record on screen. */
export function useFinanceAction(action: (previous: ErpActionResult, form: FormData) => Promise<ErpActionResult>, onChanged: () => void) {
  return useActionState(async (previous: ErpActionResult, form: FormData) => {
    const result = await action(previous, form);
    if (result.ok) onChanged();
    return result;
  }, INITIAL_RESULT);
}

function ReviewEntry({ detail, onChanged }: { detail: EntryDetail; onChanged: () => void }) {
  const [state, action, pending] = useFinanceAction(reviewFinancialEntryAction, onChanged);
  const id = `entry-review-${detail.entry.id}`;
  return <form action={action} className={FORM_STACK}>
    <input type="hidden" name="id" value={detail.entry.id} /><input type="hidden" name="version" value={detail.entry.version} />
    <Field><FieldLabel htmlFor={id}>Parecer da conferência</FieldLabel>
      <Textarea id={id} name="reason" required minLength={5} maxLength={300} disabled={pending} /></Field>
    {!detail.entry.evidenceDocumentId ? <ErpNote>A aprovação exige evidência do valor conferido.</ErpNote> : null}
    <FinanceFeedback result={state} />
    <div className="flex flex-wrap gap-2">
      <Button type="submit" name="decision" value="approve" disabled={pending || !detail.entry.evidenceDocumentId}>Aprovar valor conferido</Button>
      <Button type="submit" name="decision" value="reject" variant="outline" disabled={pending}>Rejeitar lançamento</Button>
    </div>
  </form>;
}

function SettlementForm({ detail, reversalId, onChanged }: { detail: EntryDetail; reversalId?: string; onChanged: () => void }) {
  const [state, action, pending] = useFinanceAction(reversalId ? reverseSettlementAction : prepareSettlementAction, onChanged);
  const [requestId] = useState(() => crypto.randomUUID());
  const prefix = `${reversalId ?? "settlement"}-${detail.entry.id}`;
  const evidenceOptions = [{ value: "", label: "Selecione uma evidência" }, ...detail.documents.map((row) => ({ value: row.id, label: row.fileName }))];
  return <form action={action} className={FORM_STACK}>
    <input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="entryId" value={detail.entry.id} />
    {reversalId ? <input type="hidden" name="settlementId" value={reversalId} /> : <Field>
      <FieldLabel htmlFor={`${prefix}-amount`}>Valor efetivamente liquidado (R$)</FieldLabel>
      <Input id={`${prefix}-amount`} name="amount" inputMode="decimal" required disabled={pending} /></Field>}
    <Field><FieldLabel htmlFor={`${prefix}-date`}>{reversalId ? "Data do estorno" : "Data do fato"}</FieldLabel>
      <Input id={`${prefix}-date`} name="occurredOn" type="date" required disabled={pending} /></Field>
    <Field><FieldLabel htmlFor={`${prefix}-proof`}>Evidência conferida</FieldLabel>
      <AppSelect id={`${prefix}-proof`} name="evidenceDocumentId" required disabled={pending} options={evidenceOptions} /></Field>
    <Field><FieldLabel htmlFor={`${prefix}-reason`}>Descrição e motivo</FieldLabel>
      <Textarea id={`${prefix}-reason`} name="reason" required minLength={5} maxLength={300} disabled={pending} /></Field>
    <FinanceFeedback result={state} />
    <div><Button type="submit" variant="outline" loading={pending}>{reversalId ? "Preparar estorno para revisão" : "Preparar liquidação para revisão"}</Button></div>
  </form>;
}

function MovementReview({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [state, action, pending] = useFinanceAction(reviewSettlementAction, onChanged);
  return <form action={action} className={FORM_STACK}>
    <input type="hidden" name="id" value={id} />
    <Field><FieldLabel htmlFor={`movement-review-${id}`}>Parecer da revisão</FieldLabel>
      <Textarea id={`movement-review-${id}`} name="reason" required minLength={5} maxLength={300} disabled={pending} /></Field>
    <FinanceFeedback result={state} />
    <div className="flex flex-wrap gap-2">
      <Button type="submit" name="decision" value="confirm" disabled={pending}>Confirmar liquidação</Button>
      <Button type="submit" name="decision" value="reject" variant="outline" disabled={pending}>Rejeitar</Button>
    </div>
  </form>;
}

export function canReverse(detail: EntryDetail, movement: EntryMovement) {
  return detail.canPrepare && movement.kind === "payment" && movement.status === "confirmed";
}
export function movementLabel(movement: EntryMovement) {
  return movement.kind === "reversal" ? "Estorno" : "Liquidação";
}

/** The one form that applies to a movement: review when pending, reversal when it is a confirmed payment. */
export function MovementForm({ detail, movement, onChanged }: { detail: EntryDetail; movement: EntryMovement; onChanged: () => void }) {
  if (movement.canReview) return <MovementReview id={movement.id} onChanged={onChanged} />;
  if (canReverse(detail, movement)) return <SettlementForm detail={detail} reversalId={movement.id} onChanged={onChanged} />;
  return null;
}
export function movementMenu(detail: EntryDetail, movement: EntryMovement, open: () => void): ErpMenuItem[] {
  const items: ErpMenuItem[] = [];
  if (movement.canReview) items.push({ id: "review", label: "Conferir liquidação", onSelect: open });
  if (canReverse(detail, movement)) items.push({ id: "reverse", label: "Solicitar estorno", onSelect: open });
  return items;
}

/** Evidence, independent review and settlement of an entry. */
export function EvidenceBlock({ detail, onChanged }: { detail: EntryDetail; onChanged: () => void }) {
  return <div className={FORM_STACK}>
    {detail.documents.length ? <ul className="flex flex-col gap-1">{detail.documents.map((row) => <li key={row.id}>
      <Button variant="link" render={<a href={`/api/erp/documents/${row.id}`} />}>{row.fileName}</Button></li>)}</ul>
      : <ErpNote>Nenhuma evidência enviada.</ErpNote>}
    {detail.canPrepare ? <EvidenceUpload detail={detail} onChanged={onChanged} /> : null}
  </div>;
}
export function ReviewBlock({ detail, onChanged }: { detail: EntryDetail; onChanged: () => void }) {
  return detail.canApprove ? <ReviewEntry detail={detail} onChanged={onChanged} />
    : <ErpNote>Aguardando revisão por outra pessoa com permissão de aprovação.</ErpNote>;
}
export function SettlementBlock({ detail, onChanged }: { detail: EntryDetail; onChanged: () => void }) {
  return <div className={FORM_STACK}>
    <ErpNote>Registra um fato comprovado. Esta ação não realiza transferência bancária.</ErpNote>
    <SettlementForm key={`payment-${detail.movements.length}`} detail={detail} onChanged={onChanged} />
  </div>;
}
/** Which action blocks an entry shows to this viewer (same flags the services return). */
export function entryBlocks(detail: EntryDetail) {
  return {
    evidence: detail.agency,
    review: detail.entry.status === "submitted",
    settlement: detail.entry.status === "approved" && detail.canPrepare,
  };
}

function Titled({ title, children }: { title: string; children: ReactNode }) {
  return <div className={FORM_STACK}><p className="text-sm font-medium">{title}</p>{children}</div>;
}

function EntrySummary({ detail }: { detail: EntryDetail }) {
  const values = [
    { label: "Conferido", value: detail.entry.amountCents },
    { label: "Liquidado", value: detail.settledCents },
    { label: "Saldo a liquidar", value: detail.entry.amountCents - detail.settledCents },
  ];
  return <div className={FORM_STACK}>
    <div className="flex flex-wrap gap-2"><EntryStatusBadge status={detail.entry.status} />
      <Badge variant="outline">{FINANCIAL_LABELS[detail.entry.kind]}</Badge></div>
    <p className="text-sm">{detail.entry.description}</p>
    <dl className="grid grid-cols-3 gap-3">{values.map((item) => <div key={item.label}>
      <dt className="text-xs text-muted-foreground">{item.label}</dt><dd className="text-sm font-semibold tabular-nums">{formatCents(item.value)}</dd>
    </div>)}</dl>
    <ErpNote>Competência {detail.entry.competence} · vencimento {formatDate(detail.entry.dueOn)}</ErpNote>
  </div>;
}

/** Movements inside the drawer: a short list; the row menu opens the applicable form below it. */
function DrawerMovements({ detail, onChanged }: { detail: EntryDetail; onChanged: () => void }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = detail.movements.find((row) => row.id === activeId) ?? null;
  return <Titled title="Liquidações e estornos">
    {detail.movements.length ? <ul className="flex flex-col divide-y divide-border">{detail.movements.map((row) => <li key={row.id}
      className="flex items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="text-sm">{movementLabel(row)} · <span className="tabular-nums">{formatCents(row.amountCents)}</span></p>
        <p className="text-xs text-muted-foreground">{formatDate(row.occurredOn)}</p>
      </div>
      <div className="flex items-center gap-1"><MovementStatusBadge status={row.status} />
        <ErpRowMenu label={`Ações de ${movementLabel(row).toLowerCase()}`} items={movementMenu(detail, row, () => setActiveId(row.id))} /></div>
    </li>)}</ul> : <ErpNote>Nenhuma liquidação registrada.</ErpNote>}
    {active ? <Titled title={`${active.canReview ? "Conferir liquidação" : "Solicitar estorno"} · ${formatCents(active.amountCents)}`}>
      {active.reason ? <ErpNote>{active.reason}</ErpNote> : null}
      <MovementForm key={active.id} detail={detail} movement={active} onChanged={() => { setActiveId(null); onChanged(); }} />
      <div><Button type="button" variant="ghost" onClick={() => setActiveId(null)}>Cancelar</Button></div>
    </Titled> : null}
  </Titled>;
}

/** Drawer body of an entry: summary, link to the full record and every action the viewer may take. */
export function EntryPanelBody({ detail, onChanged }: { detail: EntryDetail; onChanged: () => void }) {
  const blocks = entryBlocks(detail);
  return <>
    <EntrySummary detail={detail} />
    <div><Button variant="outline" render={<Link href={`/financeiro/lancamentos/${detail.entry.id}`} />}>Abrir ficha completa</Button></div>
    {blocks.evidence ? <Titled title="Evidências"><EvidenceBlock detail={detail} onChanged={onChanged} /></Titled> : null}
    {blocks.review ? <Titled title="Conferência independente"><ReviewBlock detail={detail} onChanged={onChanged} /></Titled> : null}
    {blocks.settlement ? <Titled title="Registrar liquidação"><SettlementBlock detail={detail} onChanged={onChanged} /></Titled> : null}
    <DrawerMovements detail={detail} onChanged={onChanged} />
  </>;
}

type Entries = Awaited<ReturnType<typeof getFinancialEntries>>;
type EntryRow = Entries["rows"][number];
const ENTRY_COLUMNS: ErpColumn<EntryRow>[] = [
  { id: "description", label: "Lançamento", primary: true, render: (row) => <ErpCell title={row.description} sub={`${FINANCIAL_LABELS[row.kind]} · Ref. ${row.reference}`} /> },
  { id: "beneficiary", label: "Beneficiário", nowrap: true, render: (row) => row.beneficiaryName ?? "Sem beneficiário" },
  { id: "competence", label: "Competência", nowrap: true, render: (row) => formatCompetence(row.competence) },
  { id: "amount", label: "Valor", numeric: true, render: (row) => formatCents(row.amountCents) },
  { id: "settled", label: "Liquidado", numeric: true, render: (row) => formatCents(row.settledCents) },
  { id: "status", label: "Estado", render: (row) => <EntryStatusBadge status={row.status} /> },
];

/**
 * The ledger list of a screen: one table of entries, row → drawer with the entry and its actions, pagination by URL.
 * The page header owns the primary CTA (`ErpPrimaryAction`, `?novo=1` by default); this list owns its drawer.
 */
export function FinanceLedger({ data, branches, title, description, emptyTitle = "Nenhum lançamento neste filtro", emptyText, defaultKind, createParam = "novo" }: {
  data: Entries;
  branches: Branches | null;
  title: string;
  description?: string;
  emptyTitle?: string;
  emptyText: string;
  defaultKind: FinancialKind;
  /** URL parameter that opens "Preparar lançamento" (the header CTA links to it). */
  createParam?: string;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EntryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const creating = useUrlPanel(createParam);
  const [loading, startLoading] = useTransition();

  function load(id: string) {
    startLoading(async () => {
      const result = await loadFinancialEntryAction(id);
      setDetail(result.ok ? result.data : null);
      setError(result.ok ? null : result.message);
    });
  }
  function openEntry(id: string) {
    setOpenId(id);
    setDetail(null);
    setError(null);
    load(id);
  }
  function changed() {
    router.refresh();
    if (openId) load(openId);
  }
  const row = data.rows.find((item) => item.id === openId);
  const canCreate = data.canPrepare && !!branches;
  return <>
    <ErpList<EntryRow>
      title={title}
      description={description}
      count={data.total}
      countLabel={["lançamento", "lançamentos"]}
      // O corretor só vê os próprios lançamentos já aprovados: beneficiário e estado repetiriam o óbvio.
      columns={data.agency ? ENTRY_COLUMNS : ENTRY_COLUMNS.filter((column) => column.id !== "beneficiary" && column.id !== "status")}
      rows={data.rows}
      rowKey={(item) => item.id}
      onRowOpen={(item) => openEntry(item.id)}
      emptyTitle={emptyTitle}
      emptyText={emptyText}
      footer={<ErpPager page={data.filters.page} total={data.total} pageSize={data.pageSize} label="Paginação dos lançamentos" />}
    />
    <ErpPanel open={openId !== null} onOpenChange={(open) => { if (!open) setOpenId(null); }}
      title={detail?.entry.description ?? row?.description ?? "Lançamento"} description={detail ? `${FINANCIAL_LABELS[detail.entry.kind]} · Ref. ${detail.entry.reference}` : undefined}>
      {detail ? <EntryPanelBody detail={detail} onChanged={changed} />
        : error ? <FieldError>{error}</FieldError>
          : <p role="status" className="text-sm text-muted-foreground">{loading ? "Carregando lançamento…" : ""}</p>}
    </ErpPanel>
    {canCreate && branches ? <ErpPanel open={creating.open} onOpenChange={(open) => { if (!open) creating.close(); }} title="Preparar lançamento"
      description="Informe o valor conferido e sua referência. A aprovação exige evidência e outra pessoa autorizada.">
      {creating.open ? <NewEntryForm branches={branches} defaultKind={defaultKind}
        onCreated={(id) => { creating.close(); router.refresh(); openEntry(id); }} /> : null}
    </ErpPanel> : null}
  </>;
}
