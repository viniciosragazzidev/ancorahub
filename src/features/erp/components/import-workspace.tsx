"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition as startAction, useActionState, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel, FieldSuccess } from "@/components/ui/field";
import { StatCard } from "@/components/dashboard/metric-card";
import { AppSelect } from "@/components/ui/select";
import { ErpCell, ErpList, ErpNote, ErpPanel, ErpSection, ErpStats, ErpStatus, useUrlPanel, type ErpColumn, type ErpTone } from "../ui/erp-kit";
import { formatCompetence, formatDay as formatKitDay, formatInstant } from "../ui/format";
import { FINANCIAL_LABELS, IMPLANTATION_LABELS, IMPORT_STATUS, formatCents, type ErpActionResult } from "../contracts";
import { submitErpFile } from "../client-file-request";
import { reviewErpImportAction } from "../import-actions";
import type { getErpImport, getErpImports } from "../imports";

type ImportDomain = "implantations" | "finance";
type ImportsData = Awaited<ReturnType<typeof getErpImports>>;
type BatchRow = ImportsData["rows"][number];
type Batch = Awaited<ReturnType<typeof getErpImport>>;
type ImplantationLine = Batch["rows"][number];
type FinanceLine = Batch["financeRows"][number];

const INITIAL: ErpActionResult = { ok: true, message: "" };
const DOMAIN_LABELS: Record<ImportDomain, string> = { implantations: "Implantação", finance: "Lançamentos financeiros" };

function formatMoment(value: Date | string) {
  return formatInstant(value);
}

function formatDay(value: string | null) {
  return value ? formatKitDay(value) : null;
}

function Feedback({ result }: { result: ErpActionResult }) {
  if (!result.message) return null;
  return result.ok ? <FieldSuccess role="status">{result.message}</FieldSuccess> : <FieldError role="alert">{result.message}</FieldError>;
}

const STATUS_TONE: Record<keyof typeof IMPORT_STATUS, ErpTone> = { preview: "warning", applied: "success", rejected: "danger" };

function StatusBadge({ status }: { status: keyof typeof IMPORT_STATUS }) {
  return <ErpStatus tone={STATUS_TONE[status] ?? "neutral"}>{IMPORT_STATUS[status]}</ErpStatus>;
}

/** Upload form of a new batch (inside the "Nova importação" drawer). */
export function ImportUpload({ maxRows, domains }: { maxRows: number; domains: readonly ImportDomain[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState(INITIAL);
  const [domain, setDomain] = useState<ImportDomain>(domains[0] ?? "implantations");
  const finance = domain === "finance";
  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("domain", domain);
    startTransition(async () => {
      const response = await submitErpFile("/api/erp/imports", form);
      setResult(response);
      if (response.ok && response.id) router.push(`/administracao/importacoes/${response.id}`);
    });
  }
  return <form onSubmit={preview} className="flex flex-col gap-4" aria-label="Nova importação">
    {domains.length > 1 ? <Field><FieldLabel htmlFor="erp-import-domain">Tipo de importação</FieldLabel>
      <AppSelect id="erp-import-domain" value={domain} options={domains.map((value) => ({ value, label: DOMAIN_LABELS[value] }))}
        onValueChange={(value) => { if (value === "finance" || value === "implantations") setDomain(value); setResult(INITIAL); }} /></Field> : null}
    <Field><FieldLabel htmlFor="erp-import-file">{finance ? "Arquivo de lançamentos" : "Arquivo de implantação"}</FieldLabel>
      <Input id="erp-import-file" name="file" type="file" accept=".csv,.xlsx" required disabled={pending} /></Field>
    <ErpNote>CSV UTF-8 ou XLSX, até 2 MB e {maxRows} linhas. Nenhuma linha é aplicada durante a prévia.</ErpNote>
    <ul className="flex list-disc flex-col gap-1.5 pl-4 text-xs leading-5 text-muted-foreground">
      {(finance ? [
        "Datas no formato AAAA-MM-DD e competência AAAA-MM.",
        "Tipo: recebível, mensalidade, comissão, despesa ou adiantamento. Valor com vírgula ou ponto e até duas casas.",
        "Recebível, mensalidade e comissão exigem o código da venda; comissão e adiantamento exigem o código do beneficiário.",
        "A referência é única por tipo: reenviar a mesma referência não duplica o lançamento.",
        "Cada linha vira um lançamento a conferir: evidência e aprovação continuam na ficha do lançamento.",
      ] : [
        "Use o código do negócio disponível na ficha de Implantação. Datas no formato AAAA-MM-DD.",
        "Etapas: awaiting_documents, review, submitted, operator_pending, implanted, refused ou cancelled.",
        "Para confirmar implantação, informe apólice, início da cobertura e o código da evidência enviada pelo módulo.",
        "Recusa, cancelamento e reabertura exigem motivo.",
      ]).map((rule) => <li key={rule}>{rule}</li>)}
    </ul>
    <Feedback result={result} />
    <div className="flex flex-wrap gap-2">
      <Button type="submit" loading={pending}>Preparar prévia</Button>
      <Button variant="outline" render={<a href={finance ? "/api/erp/imports/template?domain=finance" : "/api/erp/imports/template"} />}>Baixar modelo</Button>
    </div>
  </form>;
}

function BatchSummary({ batch }: { batch: BatchRow }) {
  return <>
    <dl className="grid grid-cols-2 gap-3 text-sm">
      <div><dt className="text-xs text-muted-foreground">Estado</dt><dd><StatusBadge status={batch.status} /></dd></div>
      <div><dt className="text-xs text-muted-foreground">Tipo</dt><dd>{DOMAIN_LABELS[batch.domain]}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Preparado por</dt><dd>{batch.createdBy ?? "Responsável registrado"}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Linhas</dt><dd className="tabular-nums">{batch.rowCount}</dd></div>
      <div className="col-span-2"><dt className="text-xs text-muted-foreground">Prévia preparada em</dt><dd>{formatMoment(batch.createdAt)}</dd></div>
    </dl>
    <div><Button render={<Link href={`/administracao/importacoes/${batch.id}`} />}>Conferir lote</Button></div>
  </>;
}

export function ImportsWorkspace({ data, toolbar }: { data: ImportsData; toolbar?: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const creating = useUrlPanel("novo");
  const selected = data.rows.find((row) => row.id === selectedId) ?? null;
  const columns: ErpColumn<BatchRow>[] = [
    { id: "file", label: "Arquivo", primary: true, render: (row) => <ErpCell title={row.fileName} sub={DOMAIN_LABELS[row.domain]} /> },
    { id: "author", label: "Preparado por", nowrap: true, render: (row) => row.createdBy ?? "Responsável registrado" },
    { id: "rows", label: "Linhas", numeric: true, render: (row) => row.rowCount.toLocaleString("pt-BR") },
    { id: "status", label: "Estado", render: (row) => <StatusBadge status={row.status} /> },
    { id: "created", label: "Prévia", nowrap: true, secondary: true, render: (row) => formatMoment(row.createdAt) },
  ];
  const { summary } = data;
  return <>
    <ErpStats>
      <StatCard label="A conferir" value={summary.preview} sublabel="prévias aguardando revisão" />
      <StatCard label="Aplicados" value={summary.applied} sublabel="lotes conferidos e aplicados" />
      <StatCard label="Rejeitados" value={summary.rejected} sublabel="podem ser enviados de novo" />
    </ErpStats>
    {toolbar}
    <ErpList title="Lotes de importação" count={data.rows.length} countLabel={["lote", "lotes"]} columns={columns} rows={data.rows} rowKey={(row) => row.id}
      onRowOpen={(row) => setSelectedId(row.id)}
      emptyTitle="Nenhum lote neste filtro" emptyText="Use Nova importação para enviar um arquivo e conferir a prévia antes de aplicar." />
    <ErpPanel open={creating.open} onOpenChange={(open) => { if (!open) creating.close(); }} title="Nova importação"
      description="Envie o arquivo para preparar a prévia. Outra pessoa autorizada aplica o lote.">
      {creating.open ? <ImportUpload maxRows={data.maxRows} domains={data.domains} /> : null}
    </ErpPanel>
    <ErpPanel open={!!selected} onOpenChange={(open) => { if (!open) setSelectedId(null); }} title={selected?.fileName ?? "Lote"}
      description={selected ? `${DOMAIN_LABELS[selected.domain]} · ${IMPORT_STATUS[selected.status]}` : undefined}>
      {selected ? <BatchSummary batch={selected} /> : null}
    </ErpPanel>
  </>;
}

function BatchLines({ batch }: { batch: Batch }) {
  const implantationColumns: ErpColumn<ImplantationLine>[] = [
    { id: "deal", label: "Negócio", primary: true, render: (row) => <ErpCell title={batch.leadNames[row.leadId] ?? row.leadId} sub={row.reference ? `Protocolo ${row.reference}` : undefined} /> },
    { id: "stage", label: "Etapa", render: (row) => IMPLANTATION_LABELS[row.status] },
    { id: "policy", label: "Apólice", nowrap: true, render: (row) => row.policyNumber || "A informar" },
    { id: "coverage", label: "Cobertura", nowrap: true, render: (row) => formatDay(row.coverageStartsOn) ?? "A informar" },
    { id: "check", label: "Evidência", render: (row) => <ErpStatus tone={row.evidenceDocumentId ? "success" : "neutral"}>{row.evidenceDocumentId ? "Vinculada" : "Sem evidência"}</ErpStatus> },
  ];
  const financeColumns: ErpColumn<FinanceLine>[] = [
    { id: "description", label: "Lançamento", primary: true, render: (row) => <ErpCell title={row.description} sub={`${FINANCIAL_LABELS[row.kind]} · Ref. ${row.reference}`} /> },
    { id: "amount", label: "Valor", numeric: true, render: (row) => formatCents(row.amountCents) },
    { id: "due", label: "Vencimento", nowrap: true, render: (row) => formatDay(row.dueOn) },
    { id: "competence", label: "Competência", nowrap: true, render: (row) => formatCompetence(row.competence) },
  ];
  if (batch.domain === "finance") {
    return <ErpList title="Linhas do lote" count={batch.financeRows.length} countLabel={["linha", "linhas"]} columns={financeColumns} rows={batch.financeRows} rowKey={(row) => `${row.kind}-${row.reference}`}
      emptyTitle="Lote sem linhas" emptyText="Nenhuma linha válida neste lote." />;
  }
  return <ErpList title="Linhas do lote" count={batch.rows.length} countLabel={["linha", "linhas"]} columns={implantationColumns} rows={batch.rows} rowKey={(row) => row.leadId}
    emptyTitle="Lote sem linhas" emptyText="Nenhuma linha válida neste lote." />;
}

/** Review page of a batch: summary, lines, then the independent review. */
export function ImportReview({ batch }: { batch: Batch }) {
  const [result, action, pending] = useActionState(reviewErpImportAction, INITIAL);
  const lineCount = batch.rows.length + batch.financeRows.length;
  // Submits without React's automatic form reset: the Base UI checkbox would keep its look and send "unchecked".
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const native = event.nativeEvent as SubmitEvent;
    const data = new FormData(event.currentTarget, native.submitter instanceof HTMLElement ? native.submitter : undefined);
    startAction(() => action(data));
  }
  return <>
    <ErpStats>
      <StatCard label="Estado" value={IMPORT_STATUS[batch.status]} sublabel={`${DOMAIN_LABELS[batch.domain]} · versão ${batch.version}`} />
      <StatCard label="Linhas" value={lineCount} sublabel="válidas na prévia" />
      <StatCard label="Preparado por" value={batch.createdByName ?? "Responsável"} sublabel={formatMoment(batch.createdAt)} />
    </ErpStats>
    {batch.reviewReason ? <ErpNote>Última revisão: {batch.reviewReason}</ErpNote> : null}
    <BatchLines batch={batch} />
    <ErpSection title="Revisão" description="Aplicar exige outra pessoa autorizada. Revalidar atualiza a prévia; rejeitar encerra o lote.">
      {batch.status !== "applied" ? <form onSubmit={submit} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={batch.id} />
        <input type="hidden" name="version" value={batch.version} />
        <Field><FieldLabel htmlFor="erp-import-reason">Motivo da revisão</FieldLabel>
          <Textarea id="erp-import-reason" name="reason" required minLength={5} maxLength={300} disabled={pending} /></Field>
        <label className="flex items-center gap-2 text-sm"><Checkbox name="confirmed" disabled={pending} />Conferi todas as linhas e os documentos vinculados</label>
        {!batch.canApprove ? <ErpNote>A aplicação precisa ser feita por outra pessoa autorizada. Você pode atualizar a prévia ou rejeitar este lote.</ErpNote> : null}
        <Feedback result={result} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="decision" value="apply" disabled={pending || !batch.canApprove || batch.status !== "preview"}>Aplicar lote conferido</Button>
          <Button type="submit" variant="outline" name="decision" value="refresh" disabled={pending}>Revalidar prévia</Button>
          <Button type="submit" variant="outline" name="decision" value="reject" disabled={pending}>Rejeitar lote</Button>
        </div>
      </form> : <ErpNote>Todas as linhas foram aplicadas na mesma transação. Ajustes posteriores devem ser feitos no módulo de origem.</ErpNote>}
    </ErpSection>
  </>;
}
