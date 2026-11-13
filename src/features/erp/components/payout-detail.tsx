"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCents, type ErpActionResult } from "../contracts";
import { confirmPayoutPaymentAction, registerPayoutPaymentAction, reviewPayoutAction } from "../payout-actions";
import { submitErpFile } from "../client-file-request";
import type { getPayout } from "../payouts";
import { ErpList, ErpNote, ErpSection, type ErpColumn } from "../ui/erp-kit";
import { FinanceFeedback } from "./finance-workspace";
import { formatDay, PayoutFacts, PayoutStatusBadge } from "./payout-parts";

export type PayoutDetailData = Awaited<ReturnType<typeof getPayout>>;
type PayoutItem = PayoutDetailData["items"][number];

const INITIAL: ErpActionResult = { ok: true, message: "" };

/** Parecer form of the independent steps: approve/cancel a prepared payout, or confirm/reject the registered payment. */
function DecisionForm({ detail, mode }: { detail: PayoutDetailData; mode: "review" | "confirm" }) {
  const [state, action, pending] = useActionState(mode === "review" ? reviewPayoutAction : confirmPayoutPaymentAction, INITIAL);
  const reasonId = `payout-${mode}-reason-${detail.id}`;
  return <form action={action} className="flex flex-col gap-3">
    <input type="hidden" name="id" value={detail.id} />
    <input type="hidden" name="version" value={detail.version} />
    <Field>
      <FieldLabel htmlFor={reasonId}>Parecer</FieldLabel>
      <Textarea id={reasonId} name="reason" required minLength={5} maxLength={300} disabled={pending} />
    </Field>
    <FinanceFeedback result={state} />
    <div className="flex flex-wrap gap-2">
      {mode === "review" ? <>
        {detail.canApprove ? <Button type="submit" name="decision" value="approve" disabled={pending}>Aprovar repasse</Button> : null}
        {detail.canCancel ? <Button type="submit" name="decision" value="cancel" variant="outline" disabled={pending}>Cancelar repasse</Button> : null}
      </> : <>
        <Button type="submit" name="decision" value="confirm" disabled={pending}>Confirmar pagamento e emitir recibo</Button>
        <Button type="submit" name="decision" value="reject" variant="outline" disabled={pending}>Rejeitar comprovante</Button>
      </>}
    </div>
  </form>;
}

/** Proof upload, then the payment registration that waits for another person's conference. */
function PaymentForm({ detail }: { detail: PayoutDetailData }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(registerPayoutPaymentAction, INITIAL);
  const [requestId] = useState(() => crypto.randomUUID());
  const [uploading, startUpload] = useTransition();
  const [upload, setUpload] = useState(INITIAL);
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    form.set("module", "payout");
    form.set("payoutId", detail.id);
    startUpload(async () => {
      const response = await submitErpFile("/api/erp/evidence", form);
      setUpload(response);
      if (response.ok) {
        element.reset();
        router.refresh();
      }
    });
  }
  return <div className="flex flex-col gap-4">
    <form onSubmit={send} className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor={`payout-proof-file-${detail.id}`}>Comprovante do pagamento (PDF, PNG ou JPEG)</FieldLabel>
        <Input id={`payout-proof-file-${detail.id}`} name="file" type="file" accept="application/pdf,image/png,image/jpeg" required disabled={uploading} />
      </Field>
      <FinanceFeedback result={upload} />
      <div><Button type="submit" variant="outline" loading={uploading}>Enviar comprovante</Button></div>
    </form>
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={detail.id} />
      <input type="hidden" name="version" value={detail.version} />
      <input type="hidden" name="requestId" value={requestId} />
      <Field>
        <FieldLabel htmlFor={`payout-proof-${detail.id}`}>Comprovante conferido</FieldLabel>
        <AppSelect id={`payout-proof-${detail.id}`} name="evidenceDocumentId" required
          options={[{ value: "", label: "Selecione o comprovante" }, ...detail.documents.map((row) => ({ value: row.id, label: row.fileName }))]} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`payout-date-${detail.id}`}>Data do pagamento</FieldLabel>
        <Input id={`payout-date-${detail.id}`} name="occurredOn" type="date" required disabled={pending} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`payout-reason-${detail.id}`}>Descrição</FieldLabel>
        <Textarea id={`payout-reason-${detail.id}`} name="reason" required minLength={5} maxLength={300} disabled={pending} />
      </Field>
      <FinanceFeedback result={state} />
      <div><Button type="submit" loading={pending}>Registrar pagamento para conferência</Button></div>
    </form>
  </div>;
}

export function PayoutSummary({ detail }: { detail: PayoutDetailData }) {
  return <div className="flex flex-col gap-3">
    <div className="flex flex-wrap gap-2">
      <PayoutStatusBadge status={detail.status} />
      {detail.receiptNumber ? <Badge variant="outline">Recibo {detail.receiptNumber}</Badge> : null}
    </div>
    <PayoutFacts items={[
      { label: "Beneficiário", value: detail.beneficiaryName },
      { label: "Competência", value: detail.competence },
      { label: "Valor líquido", value: formatCents(detail.netCents) },
      { label: "Comissões", value: String(detail.items.length) },
      ...(detail.reversedCents > 0 ? [{ label: "Estornado depois da emissão", value: formatCents(detail.reversedCents) }] : []),
    ]} />
    {detail.occurredOn ? <ErpNote>Pagamento informado em {formatDay(detail.occurredOn)}. Registrar o pagamento não faz transferência bancária.</ErpNote> : null}
    {detail.reversedCents > 0 ? <ErpNote>Estornado depois da emissão: {formatCents(detail.reversedCents)}. O recibo continua como foi emitido.</ErpNote> : null}
    {detail.reason ? <ErpNote>Último parecer: {detail.reason}</ErpNote> : null}
  </div>;
}

function EntryLink({ item }: { item: PayoutItem }) {
  return <Button variant="link" className="h-auto p-0" render={<Link href={`/financeiro/lancamentos/${item.entryId}`} />}>{item.reference}</Button>;
}

/** Compact item list for the drawer (the full page uses ErpList). */
export function PayoutItemsCompact({ detail }: { detail: PayoutDetailData }) {
  return <ul className="flex flex-col divide-y divide-border">
    {detail.items.map((item) => <li key={item.entryId} className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <EntryLink item={item} />
        <p className="truncate text-xs text-muted-foreground">{item.description}</p>
      </div>
      <span className="text-sm tabular-nums">{formatCents(item.balanceCents)}</span>
    </li>)}
  </ul>;
}

export function PayoutItemsList({ detail }: { detail: PayoutDetailData }) {
  const columns: ErpColumn<PayoutItem>[] = [
    { id: "reference", label: "Comissão", primary: true,
      render: (item) => <EntryLink item={item} /> },
    { id: "description", label: "Descrição", secondary: true, render: (item) => item.description },
    { id: "amount", label: "Valor conferido", numeric: true, render: (item) => formatCents(item.amountCents) },
    { id: "balance", label: "Neste repasse", numeric: true, render: (item) => formatCents(item.balanceCents) },
  ];
  return <ErpList title="Comissões do repasse" columns={columns} rows={detail.items} rowKey={(item) => item.entryId}
    emptyTitle="Nenhuma comissão neste repasse" emptyText="Um repasse cancelado devolve as comissões para novos repasses." />;
}

/** Next step of the payout, shown only to whoever can act (flags come from the service). */
export function PayoutSteps({ detail }: { detail: PayoutDetailData }) {
  if (detail.status === "prepared") {
    if (!detail.canApprove && !detail.canCancel) return <ErpNote>Aguardando aprovação por outra pessoa autorizada.</ErpNote>;
    return <StepBlock title="Conferência independente"><DecisionForm detail={detail} mode="review" /></StepBlock>;
  }
  if (detail.status === "approved") {
    if (!detail.canRegisterPayment && !detail.canCancel) return <ErpNote>Aprovado. Aguardando o registro do pagamento.</ErpNote>;
    return <>
      {detail.canRegisterPayment ? <StepBlock title="Registrar pagamento"><PaymentForm detail={detail} /></StepBlock> : null}
      {detail.canCancel ? <StepBlock title="Cancelar este repasse"><DecisionForm detail={detail} mode="review" /></StepBlock> : null}
    </>;
  }
  if (detail.status === "paying") {
    if (!detail.canConfirmPayment) return <ErpNote>Aguardando a conferência do comprovante por outra pessoa autorizada.</ErpNote>;
    return <StepBlock title="Conferir pagamento"><DecisionForm detail={detail} mode="confirm" /></StepBlock>;
  }
  if (detail.status === "cancelled") return <ErpNote>Repasse cancelado. As comissões voltaram a ficar disponíveis para um novo repasse.</ErpNote>;
  if (detail.status === "settled") return <div><Button variant="outline" render={<Link href={`/financeiro/recibos/${detail.id}`} />}>Abrir recibo</Button></div>;
  return null;
}

function StepBlock({ title, children }: { title: string; children: ReactNode }) {
  return <div className="flex flex-col gap-3 border-t border-border pt-4">
    <h3 className="text-sm font-semibold">{title}</h3>
    {children}
  </div>;
}

/** Full payout page body: summary, items, steps. */
export function PayoutDetailPage({ detail }: { detail: PayoutDetailData }) {
  return <>
    <ErpSection title="Resumo do repasse"><PayoutSummary detail={detail} /></ErpSection>
    <PayoutItemsList detail={detail} />
    <ErpSection title="Próximo passo"><PayoutSteps detail={detail} /></ErpSection>
  </>;
}
