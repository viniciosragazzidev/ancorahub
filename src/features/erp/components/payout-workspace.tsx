"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AppSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents, type ErpActionResult } from "../contracts";
import { confirmPayoutPaymentAction, preparePayoutAction, registerPayoutPaymentAction, reviewPayoutAction } from "../payout-actions";
import { bringScheduleAction } from "../commission-actions";
import { submitErpFile } from "../client-file-request";
import { FinanceFeedback } from "./finance-workspace";
import type { getPayout, getPayoutCandidates, getPayouts, PayoutReceipt } from "../payouts";
import type { getCommissionOverview } from "../commissions";
import type { getReconciliation, ReconciliationIssue } from "../reconciliation";
import page from "@/components/lite/page/lite-page.module.css";

const INITIAL: ErpActionResult = { ok: true, message: "" };
const LEGACY_STATUS: Record<string, string> = { pending: "Pendente", paid: "Pago", cancelled: "Cancelado", chargeback_pending: "Revisão de estorno" };
const ENTRY_STATUS: Record<string, string> = { submitted: "A aprovar", approved: "Conferido", rejected: "Rejeitado" };
const PAYOUT_STATUS: Record<string, string> = { prepared: "Aguardando aprovação", approved: "Aprovado para pagamento", paying: "Pagamento a conferir", settled: "Liquidado", cancelled: "Cancelado" };
const date = (value: string | null) => value ? value.split("-").reverse().join("/") : "—";

function BringSchedule({ saleId }: { saleId: string }) {
  const [state, action, pending] = useActionState(bringScheduleAction, INITIAL);
  return <form action={action} className="flex flex-col gap-1"><input type="hidden" name="saleId" value={saleId} /><Button type="submit" variant="outline" size="sm" loading={pending}>Conferir no ERP</Button><FinanceFeedback result={state} /></form>;
}

export function CommissionsTable({ data }: { data: Awaited<ReturnType<typeof getCommissionOverview>> }) {
  if (!data.rows.length) return <section className={page.empty}><h2 className={page.emptyTitle}>Nenhuma parcela de comissão neste filtro</h2><p className={page.emptyText}>As parcelas nascem do cronograma da venda registrada. Sem cronograma, não há valor previsto.</p></section>;
  const shownSale = new Set<string>();
  return <Table><TableHeader><TableRow><TableHead>Venda</TableHead><TableHead>Parcela</TableHead><TableHead className={page.numeric}>Previsto</TableHead><TableHead>Cronograma</TableHead><TableHead>Conferência</TableHead><TableHead className={page.numeric}>Pago ao corretor</TableHead>{data.canBring ? <TableHead>Ação</TableHead> : null}</TableRow></TableHeader>
    <TableBody>{data.rows.map((row) => {
      const firstOfSale = !shownSale.has(row.saleId); shownSale.add(row.saleId);
      return <TableRow key={row.id}><TableCell><p className={page.cellTitle}>{row.clientName}</p><p className={page.cellSub}>{row.brokerName ?? "Corretor"}{row.saleStatus !== "active" ? " · venda cancelada" : ""}</p></TableCell>
        <TableCell><p className={page.cellTitle}>{row.monthNumber}ª · {row.referenceMonth}</p><p className={page.cellSub}>{row.percentage}%</p></TableCell>
        <TableCell className={page.numeric}>{formatCents(row.expectedCents)}</TableCell><TableCell><Badge variant="outline">{LEGACY_STATUS[row.legacyStatus] ?? row.legacyStatus}</Badge></TableCell>
        <TableCell>{row.entry ? <div className="flex flex-col gap-1"><Button variant="link" className="h-auto p-0" render={<Link href={`/financeiro/lancamentos/${row.entry.id}`} />}>{ENTRY_STATUS[row.entry.status] ?? "A conferir"} · {formatCents(row.entry.amountCents)}</Button>{row.divergence ? <Badge variant="secondary">Divergência</Badge> : null}</div> : <span className="text-sm text-muted-foreground">Não conferida</span>}</TableCell>
        <TableCell className={page.numeric}>{row.entry ? <><p>{formatCents(row.paidCents)}</p>{row.offsetCents ? <p className={page.cellSub}>+ {formatCents(row.offsetCents)} compensado</p> : null}</> : "—"}</TableCell>
        {data.canBring ? <TableCell>{firstOfSale && row.saleStatus === "active" && row.legacyStatus === "pending" && !row.entry ? <BringSchedule saleId={row.saleId} /> : null}</TableCell> : null}</TableRow>;
    })}</TableBody></Table>;
}

export function PayoutCandidates({ data }: { data: Awaited<ReturnType<typeof getPayoutCandidates>> }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [beneficiaryId, setBeneficiaryId] = useState(""); const [selected, setSelected] = useState<string[]>([]);
  const [requestId, setRequestId] = useState(""); const [result, setResult] = useState(INITIAL); const [pending, startTransition] = useTransition();
  const group = data.groups.find((row) => row.beneficiaryId === beneficiaryId);
  const total = useMemo(() => (group?.items ?? []).filter((item) => selected.includes(item.id)).reduce((sum, item) => sum + item.balanceCents, 0), [group, selected]);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); startTransition(async () => { const response = await preparePayoutAction(INITIAL, form); setResult(response); if (response.ok && response.id) { setOpen(false); router.push(`/financeiro/repasses/${response.id}`); } }); }
  return <><Button onClick={() => { setRequestId(crypto.randomUUID()); setResult(INITIAL); setSelected([]); setBeneficiaryId(data.groups[0]?.beneficiaryId ?? ""); setOpen(true); }} disabled={!data.groups.length}>Preparar repasse</Button>
    <Sheet open={open} onOpenChange={setOpen}><SheetContent><SheetHeader><SheetTitle>Preparar repasse</SheetTitle><SheetDescription>Selecione comissões aprovadas com saldo. O valor de cada item é o saldo depois de liquidações e compensações confirmadas.</SheetDescription></SheetHeader><SheetBody contentClassName={page.stack}>
      <form onSubmit={submit} className={page.group}><input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="beneficiaryId" value={beneficiaryId} />{selected.map((id) => <input key={id} type="hidden" name="entryId" value={id} />)}
        <Field><FieldLabel htmlFor="payout-beneficiary">Beneficiário</FieldLabel><AppSelect id="payout-beneficiary" value={beneficiaryId} onValueChange={(value) => { setBeneficiaryId(value); setSelected([]); }} options={data.groups.map((row) => ({ value: row.beneficiaryId, label: `${row.name} · ${row.items.length} comissão(ões)` }))} /></Field>
        <Field><FieldLabel htmlFor="payout-competence">Competência do repasse</FieldLabel><Input id="payout-competence" name="competence" type="month" required defaultValue={data.competence ?? ""} /></Field>
        <fieldset className={page.group}><legend className="text-sm font-medium">Comissões</legend>{(group?.items ?? []).map((item) => <label key={item.id} className="flex items-start gap-2 text-sm"><Checkbox aria-label={`Incluir ${item.reference}`} checked={selected.includes(item.id)} onCheckedChange={(checked) => setSelected((current) => checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span><span className="font-medium">{item.reference}</span> · saldo {formatCents(item.balanceCents)}<br /><span className="text-muted-foreground">{item.description} · competência {item.competence}</span></span></label>)}</fieldset>
        <p className="text-sm">Valor líquido do repasse: <strong>{formatCents(total)}</strong></p><FinanceFeedback result={result} /><Button type="submit" loading={pending} disabled={!selected.length}>Preparar para aprovação</Button>
      </form></SheetBody></SheetContent></Sheet></>;
}

export function PayoutsTable({ data, receipts = false }: { data: Awaited<ReturnType<typeof getPayouts>>; receipts?: boolean }) {
  if (!data.rows.length) return <section className={page.empty}><h2 className={page.emptyTitle}>{receipts ? "Nenhum recibo emitido" : "Nenhum repasse neste filtro"}</h2><p className={page.emptyText}>{receipts ? "O recibo é emitido quando o pagamento de um repasse é conferido por outra pessoa." : "Prepare um repasse a partir das comissões aprovadas com saldo."}</p></section>;
  return <Table><TableHeader><TableRow>{receipts ? <TableHead>Recibo</TableHead> : null}<TableHead>Beneficiário</TableHead><TableHead>Competência</TableHead><TableHead className={page.numeric}>Valor líquido</TableHead><TableHead>Estado</TableHead><TableHead>Detalhes</TableHead></TableRow></TableHeader>
    <TableBody>{data.rows.map((row) => <TableRow key={row.id}>{receipts ? <TableCell>{row.receiptNumber}</TableCell> : null}<TableCell>{row.beneficiaryName}</TableCell><TableCell>{row.competence}</TableCell><TableCell className={page.numeric}>{formatCents(row.netCents)}</TableCell><TableCell><Badge variant="secondary">{PAYOUT_STATUS[row.status] ?? row.status}</Badge></TableCell>
      <TableCell><Button variant="outline" size="sm" render={<Link href={receipts ? `/financeiro/recibos/${row.id}` : `/financeiro/repasses/${row.id}`} />}>{receipts ? "Abrir recibo" : "Abrir"}</Button></TableCell></TableRow>)}</TableBody></Table>;
}

type Detail = Awaited<ReturnType<typeof getPayout>>;
function DecisionForm({ detail, mode }: { detail: Detail; mode: "review" | "confirm" }) {
  const [state, action, pending] = useActionState(mode === "review" ? reviewPayoutAction : confirmPayoutPaymentAction, INITIAL);
  return <form action={action} className={page.group}><input type="hidden" name="id" value={detail.id} /><input type="hidden" name="version" value={detail.version} />
    <Field><FieldLabel htmlFor={`payout-${mode}-reason`}>Parecer</FieldLabel><Textarea id={`payout-${mode}-reason`} name="reason" required minLength={5} maxLength={300} disabled={pending} /></Field><FinanceFeedback result={state} />
    <div className="flex flex-wrap gap-2">{mode === "review" ? <>{detail.canApprove ? <Button type="submit" name="decision" value="approve" disabled={pending}>Aprovar repasse</Button> : null}{detail.canCancel ? <Button type="submit" name="decision" value="cancel" variant="outline" disabled={pending}>Cancelar repasse</Button> : null}</>
      : <><Button type="submit" name="decision" value="confirm" disabled={pending}>Confirmar pagamento e emitir recibo</Button><Button type="submit" name="decision" value="reject" variant="outline" disabled={pending}>Rejeitar comprovante</Button></>}</div></form>;
}
function PaymentForm({ detail }: { detail: Detail }) {
  const router = useRouter(); const [state, action, pending] = useActionState(registerPayoutPaymentAction, INITIAL); const [requestId] = useState(() => crypto.randomUUID());
  const [uploading, startUpload] = useTransition(); const [upload, setUpload] = useState(INITIAL);
  function send(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const element = event.currentTarget; const form = new FormData(element); form.set("module", "payout"); form.set("payoutId", detail.id); startUpload(async () => { const response = await submitErpFile("/api/erp/evidence", form); setUpload(response); if (response.ok) { element.reset(); router.refresh(); } }); }
  return <div className={page.stack}><form onSubmit={send} className={page.group}><Field><FieldLabel htmlFor="payout-proof-file">Comprovante do pagamento (PDF, PNG ou JPEG)</FieldLabel><Input id="payout-proof-file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" required disabled={uploading} /></Field><FinanceFeedback result={upload} /><div><Button type="submit" variant="outline" loading={uploading}>Enviar comprovante</Button></div></form>
    <form action={action} className={page.group}><input type="hidden" name="id" value={detail.id} /><input type="hidden" name="version" value={detail.version} /><input type="hidden" name="requestId" value={requestId} />
      <Field><FieldLabel htmlFor="payout-proof">Comprovante conferido</FieldLabel><AppSelect id="payout-proof" name="evidenceDocumentId" required options={[{ value: "", label: "Selecione o comprovante" }, ...detail.documents.map((row) => ({ value: row.id, label: row.fileName }))]} /></Field>
      <Field><FieldLabel htmlFor="payout-date">Data do pagamento</FieldLabel><Input id="payout-date" name="occurredOn" type="date" required disabled={pending} /></Field>
      <Field><FieldLabel htmlFor="payout-reason">Descrição</FieldLabel><Textarea id="payout-reason" name="reason" required minLength={5} maxLength={300} disabled={pending} /></Field><FinanceFeedback result={state} />
      <div><Button type="submit" variant="outline" loading={pending}>Registrar pagamento para conferência</Button></div></form></div>;
}
export function PayoutDetail({ detail }: { detail: Detail }) {
  return <><section className={page.group}><div className="flex flex-wrap gap-2"><Badge variant="secondary">{PAYOUT_STATUS[detail.status] ?? detail.status}</Badge>{detail.receiptNumber ? <Badge variant="outline">Recibo {detail.receiptNumber}</Badge> : null}</div>
    <dl className="grid gap-4 sm:grid-cols-3"><div><dt className="text-sm text-muted-foreground">Beneficiário</dt><dd className="font-semibold">{detail.beneficiaryName}</dd></div><div><dt className="text-sm text-muted-foreground">Competência</dt><dd className="font-semibold">{detail.competence}</dd></div><div><dt className="text-sm text-muted-foreground">Valor líquido</dt><dd className="text-lg font-semibold">{formatCents(detail.netCents)}</dd></div></dl>
    {detail.occurredOn ? <p className="text-sm text-muted-foreground">Pagamento informado em {date(detail.occurredOn)}. Registrar o pagamento não faz transferência bancária.</p> : null}{detail.reason ? <p className="text-sm text-muted-foreground">Último parecer: {detail.reason}</p> : null}</section>
    <Table><TableHeader><TableRow><TableHead>Comissão</TableHead><TableHead className={page.numeric}>Valor conferido</TableHead><TableHead className={page.numeric}>Neste repasse</TableHead></TableRow></TableHeader><TableBody>{detail.items.map((item) => <TableRow key={item.entryId}><TableCell><Button variant="link" className="h-auto p-0" render={<Link href={`/financeiro/lancamentos/${item.entryId}`} />}>{item.reference}</Button><p className={page.cellSub}>{item.description}</p></TableCell><TableCell className={page.numeric}>{formatCents(item.amountCents)}</TableCell><TableCell className={page.numeric}>{formatCents(item.balanceCents)}</TableCell></TableRow>)}</TableBody></Table>
    {detail.status === "prepared" && (detail.canApprove || detail.canCancel) ? <section className={page.group}><h2 className={page.sectionTitle}>Conferência independente</h2><DecisionForm detail={detail} mode="review" /></section> : detail.status === "prepared" ? <p className="text-sm text-muted-foreground">Aguardando aprovação por outra pessoa autorizada.</p> : null}
    {detail.status === "approved" && detail.canRegisterPayment ? <section className={page.group}><h2 className={page.sectionTitle}>Registrar pagamento</h2><PaymentForm detail={detail} />{detail.canCancel ? <details><summary className="cursor-pointer text-sm font-medium">Cancelar este repasse</summary><DecisionForm detail={detail} mode="review" /></details> : null}</section> : null}
    {detail.status === "paying" ? <section className={page.group}><h2 className={page.sectionTitle}>Conferir pagamento</h2>{detail.canConfirmPayment ? <DecisionForm detail={detail} mode="confirm" /> : <p className="text-sm text-muted-foreground">Aguardando a conferência do comprovante por outra pessoa autorizada.</p>}</section> : null}
    {detail.status === "settled" ? <div><Button variant="outline" render={<Link href={`/financeiro/recibos/${detail.id}`} />}>Abrir recibo</Button></div> : null}</>;
}

export function ReceiptView({ receipt, digest }: { receipt: PayoutReceipt; digest: string }) {
  return <article className={page.card} aria-label={`Recibo ${receipt.number}`}><header className={page.cardHead}><div><h2 className={page.cardTitle}>Recibo de repasse {receipt.number}</h2><p className={page.cardDescription}>Competência {receipt.competence} · pagamento em {date(receipt.occurredOn)}{receipt.branchName ? ` · ${receipt.branchName}` : ""}</p></div><Button variant="outline" onClick={() => window.print()}>Imprimir</Button></header>
    <dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-muted-foreground">Beneficiário</dt><dd className="font-semibold">{receipt.beneficiary.name}</dd></div><div><dt className="text-sm text-muted-foreground">Emitido por</dt><dd className="font-semibold">{receipt.issuer.name} · {new Date(receipt.issuedAt).toLocaleString("pt-BR")}</dd></div></dl>
    <Table><TableHeader><TableRow><TableHead>Comissão</TableHead><TableHead className={page.numeric}>Valor</TableHead><TableHead className={page.numeric}>Liquidado antes</TableHead><TableHead className={page.numeric}>Compensado</TableHead><TableHead className={page.numeric}>Pago neste recibo</TableHead></TableRow></TableHeader>
      <TableBody>{receipt.items.map((item) => <TableRow key={item.entryId}><TableCell><p className={page.cellTitle}>{item.reference}</p><p className={page.cellSub}>{item.description}</p></TableCell><TableCell className={page.numeric}>{formatCents(item.amountCents)}</TableCell><TableCell className={page.numeric}>{formatCents(item.previouslySettledCents)}</TableCell><TableCell className={page.numeric}>{formatCents(item.offsetCents)}</TableCell><TableCell className={page.numeric}>{formatCents(item.paidCents)}</TableCell></TableRow>)}</TableBody></Table>
    <p className="text-right text-lg font-semibold">Total pago: {formatCents(receipt.netCents)}</p>
    <p className="text-sm text-muted-foreground">Documento interno de conferência do repasse. Não é comprovante bancário nem nota fiscal. Código de integridade: {digest.slice(0, 16)}.</p></article>;
}

export function ReconciliationList({ data }: { data: Awaited<ReturnType<typeof getReconciliation>>; }) {
  const groups: { key: ReconciliationIssue["group"]; label: string }[] = [{ key: "evidence", label: "Sem evidência" }, { key: "approval", label: "Aguardando aprovação" }, { key: "movement", label: "Liquidações e compensações a conferir" }, { key: "overdue", label: "Vencidos sem liquidação registrada" }, { key: "legacy", label: "Divergências com o cronograma" }];
  if (!data.issues.length) return <section className={page.empty}><h2 className={page.emptyTitle}>Nada pendente de conferência</h2><p className={page.emptyText}>Todos os lançamentos do seu escopo estão aprovados, liquidados ou dentro do vencimento.</p></section>;
  return <>{groups.map((group) => { const rows = data.issues.filter((issue) => issue.group === group.key); return rows.length ? <section key={group.key} className={page.group}><h2 className={page.sectionTitle}>{group.label} ({rows.length})</h2><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead className={page.numeric}>Valor</TableHead><TableHead>Abrir</TableHead></TableRow></TableHeader>
    <TableBody>{rows.map((issue) => <TableRow key={issue.key}><TableCell><p className={page.cellTitle}>{issue.title}</p><p className={page.cellSub}>{issue.detail}</p></TableCell><TableCell className={page.numeric}>{issue.amountCents === null ? "—" : formatCents(issue.amountCents)}</TableCell><TableCell><Button variant="outline" size="sm" render={<Link href={issue.href} />}>Conferir</Button></TableCell></TableRow>)}</TableBody></Table></section> : null; })}
    {data.truncated ? <p className="text-sm text-muted-foreground">A fila mostra os 300 itens mais antigos de cada grupo. Resolva-os para ver os demais.</p> : null}</>;
}
