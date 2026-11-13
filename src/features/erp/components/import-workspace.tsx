"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel, FieldSuccess } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { AppSelect } from "@/components/ui/select";
import { ErpList, ErpNote, ErpPanel, ErpSection, type ErpColumn } from "../ui/erp-kit";
import { FINANCIAL_LABELS, IMPLANTATION_LABELS, IMPORT_STATUS, formatCents, type ErpActionResult } from "../contracts";
import { submitErpFile } from "../client-file-request";
import { reviewErpImportAction } from "../import-actions";
import { ERP_TIME_ZONE } from "../shared";
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
  return new Date(value).toLocaleString("pt-BR", { timeZone: ERP_TIME_ZONE, dateStyle: "short", timeStyle: "short" });
}

function formatDay(value: string | null) {
  return value ? value.split("-").reverse().join("/") : null;
}

function Feedback({ result }: { result: ErpActionResult }) {
  if (!result.message) return null;
  return result.ok ? <FieldSuccess role="status">{result.message}</FieldSuccess> : <FieldError role="alert">{result.message}</FieldError>;
}

function StatusBadge({ status }: { status: keyof typeof IMPORT_STATUS }) {
  return <Badge variant={status === "applied" ? "default" : status === "rejected" ? "outline" : "secondary"}>{IMPORT_STATUS[status]}</Badge>;
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
    <ErpNote>
      CSV UTF-8 ou XLSX, até 2 MB e {maxRows} linhas. Nenhuma linha será aplicada durante a prévia.
      {finance
        ? " Cada linha vira um lançamento a conferir: a evidência e a aprovação continuam na ficha do lançamento."
        : " Use o código do negócio disponível em Implantação."}
    </ErpNote>
    <ErpNote>
      {finance
        ? "Datas: AAAA-MM-DD; competência: AAAA-MM. Tipo: recebível, mensalidade, comissão, despesa ou adiantamento. Valor com vírgula ou ponto e até duas casas. "
          + "Recebível, mensalidade e comissão exigem o código da venda; comissão e adiantamento exigem o código do beneficiário. "
          + "A referência é única por tipo: reenviar a mesma referência não duplica o lançamento."
        : "Datas: AAAA-MM-DD. Etapas: awaiting_documents, review, submitted, operator_pending, implanted, refused ou cancelled. "
          + "Para confirmar implantação, informe apólice, início de cobertura e o código da evidência enviada pelo módulo. Recusa, cancelamento e reabertura exigem motivo."}
    </ErpNote>
    <ErpNote>Um arquivo rejeitado pode ser enviado de novo: o mesmo lote volta para conferência em uma nova versão, com você como responsável pela prévia.</ErpNote>
    <Feedback result={result} />
    <div className="flex flex-wrap gap-2">
      <Button type="submit" loading={pending}>Preparar prévia</Button>
      <Button variant="outline" render={<a href={finance ? "/api/erp/imports/template?domain=finance" : "/api/erp/imports/template"} />}>Baixar modelo</Button>
      <Button variant="ghost" render={<Link href={finance ? "/financeiro" : "/implantacoes"} />}>{finance ? "Ver lançamentos" : "Ver negócios"}</Button>
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
    <div><Button variant="outline" render={<Link href={`/administracao/importacoes/${batch.id}`} />}>Conferir lote</Button></div>
  </>;
}

export function ImportsWorkspace({ data }: { data: ImportsData }) {
  const [panel, setPanel] = useState<"new" | "batch" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data.rows.find((row) => row.id === selectedId) ?? null;
  const columns: ErpColumn<BatchRow>[] = [
    { id: "file", label: "Arquivo", primary: true, render: (row) => row.fileName },
    { id: "domain", label: "Tipo", secondary: true, render: (row) => DOMAIN_LABELS[row.domain] },
    { id: "author", label: "Preparado por", nowrap: true, render: (row) => row.createdBy ?? "Responsável registrado" },
    { id: "rows", label: "Linhas", numeric: true, render: (row) => row.rowCount },
    { id: "status", label: "Estado", render: (row) => <StatusBadge status={row.status} /> },
    { id: "created", label: "Prévia", nowrap: true, render: (row) => formatMoment(row.createdAt) },
  ];
  function openBatch(row: BatchRow) {
    setSelectedId(row.id);
    setPanel("batch");
  }
  const close = (open: boolean) => { if (!open) setPanel(null); };
  return <>
    <ErpNote>Prepare o arquivo, confira a prévia e solicite a revisão independente. Referências repetidas e alterações concorrentes impedem a aplicação.</ErpNote>
    <ErpList title="Lotes de importação" description="Os 50 lotes mais recentes do seu escopo." columns={columns} rows={data.rows} rowKey={(row) => row.id}
      onRowOpen={openBatch} actions={<Button type="button" onClick={() => setPanel("new")}>Nova importação</Button>}
      emptyTitle="Nenhum lote preparado" emptyText="Use “Nova importação” para enviar um arquivo e conferir a prévia antes de aplicar." />
    <ErpPanel open={panel === "new"} onOpenChange={close} title="Nova importação" description="Envie o arquivo para preparar a prévia. Outra pessoa autorizada aplica o lote.">
      <ImportUpload maxRows={data.maxRows} domains={data.domains} />
    </ErpPanel>
    <ErpPanel open={panel === "batch" && !!selected} onOpenChange={close} title={selected?.fileName ?? "Lote"} description="Resumo do lote. A conferência linha a linha fica na página do lote.">
      {selected ? <BatchSummary batch={selected} /> : null}
    </ErpPanel>
  </>;
}

function BatchLines({ batch }: { batch: Batch }) {
  const implantationColumns: ErpColumn<ImplantationLine>[] = [
    { id: "deal", label: "Negócio", primary: true, render: (row) => batch.leadNames[row.leadId] ?? row.leadId },
    { id: "reference", label: "Referência", secondary: true, render: (row) => row.reference || "A informar" },
    { id: "stage", label: "Etapa", render: (row) => IMPLANTATION_LABELS[row.status] },
    { id: "policy", label: "Apólice", nowrap: true, render: (row) => row.policyNumber || "A informar" },
    { id: "coverage", label: "Cobertura", nowrap: true, render: (row) => formatDay(row.coverageStartsOn) ?? "A informar" },
    { id: "check", label: "Conferência", render: (row) => `Versão ${row.expectedVersion} · ${row.evidenceDocumentId ? "evidência vinculada" : "sem evidência"}` },
  ];
  const financeColumns: ErpColumn<FinanceLine>[] = [
    { id: "reference", label: "Referência", primary: true, render: (row) => row.reference },
    { id: "description", label: "Descrição", secondary: true, render: (row) => row.description },
    { id: "kind", label: "Tipo", render: (row) => FINANCIAL_LABELS[row.kind] },
    { id: "amount", label: "Valor", numeric: true, render: (row) => formatCents(row.amountCents) },
    { id: "due", label: "Vencimento", nowrap: true, render: (row) => formatDay(row.dueOn) },
    { id: "competence", label: "Competência", nowrap: true, render: (row) => row.competence },
  ];
  if (batch.domain === "finance") {
    return <ErpList title="Linhas do lote" columns={financeColumns} rows={batch.financeRows} rowKey={(row) => `${row.kind}-${row.reference}`}
      emptyTitle="Lote sem linhas" emptyText="Nenhuma linha válida neste lote." />;
  }
  return <ErpList title="Linhas do lote" columns={implantationColumns} rows={batch.rows} rowKey={(row) => row.leadId}
    emptyTitle="Lote sem linhas" emptyText="Nenhuma linha válida neste lote." />;
}

/** Review page of a batch: summary, lines, then the independent review. */
export function ImportReview({ batch }: { batch: Batch }) {
  const [result, action, pending] = useActionState(reviewErpImportAction, INITIAL);
  const lineCount = batch.rows.length + batch.financeRows.length;
  return <>
    <ErpSection title={batch.fileName} description={`${DOMAIN_LABELS[batch.domain]} · versão ${batch.version}`}>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-muted-foreground">Estado</dt><dd><StatusBadge status={batch.status} /></dd></div>
        <div><dt className="text-xs text-muted-foreground">Linhas</dt><dd className="tabular-nums">{lineCount}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Preparado por</dt><dd>{batch.createdByName ?? "Responsável registrado"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Prévia</dt><dd>{formatMoment(batch.createdAt)}</dd></div>
      </dl>
      {batch.reviewReason ? <ErpNote>Última revisão: {batch.reviewReason}</ErpNote> : null}
    </ErpSection>
    <BatchLines batch={batch} />
    <ErpSection title="Revisão" description="Aplicar exige outra pessoa autorizada. Revalidar atualiza a prévia; rejeitar encerra o lote.">
      {batch.status !== "applied" ? <form action={action} className="flex flex-col gap-4">
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
