"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AppSelect } from "@/components/ui/select";
import { Field, FieldError, FieldLabel, FieldSuccess } from "@/components/ui/field";
import { StatCard } from "@/components/dashboard/metric-card";
import { ErpCell, ErpList, ErpNote, ErpPager, ErpPanel, ErpSearch, ErpStats, ErpStatus, ErpToolbar, ErpUrlFilter, type ErpColumn, type ErpTone } from "../ui/erp-kit";
import { formatDay as formatKitDay, formatInstant } from "../ui/format";
import { availableImplantationStages, IMPLANTATION_LABELS, IMPLANTATION_STATUSES, type ErpActionResult, type ImplantationStatus } from "../contracts";
import { adoptImplantationEvidenceAction, saveImplantationAction } from "../implantation-actions";
import { submitErpFile } from "../client-file-request";
import type { getImplantations } from "../implantations";

type Workspace = Awaited<ReturnType<typeof getImplantations>>;
type Row = Workspace["rows"][number];
type Editor = { version: number; stage: ImplantationStatus; reference: string; policyNumber: string; coverageStartsOn: string; reason: string; evidenceId: string };

const INITIAL: ErpActionResult = { ok: true, message: "" };
const STATUS_OPTIONS = [{ value: "all", label: "Todas as etapas" }, ...IMPLANTATION_STATUSES.map((status) => ({ value: status, label: IMPLANTATION_LABELS[status] }))];

function formatDay(value: string | null) {
  return value ? formatKitDay(value) : null;
}

function formatMoment(value: Date | string) {
  return formatInstant(value);
}

function editorFor(row: Row): Editor {
  return {
    version: row.version, stage: row.stage, reference: row.reference ?? "", policyNumber: row.policyNumber ?? "",
    coverageStartsOn: row.coverageStartsOn ?? "", reason: row.reason ?? "", evidenceId: row.evidenceId ?? "",
  };
}

function Feedback({ result }: { result: ErpActionResult }) {
  if (!result.message) return null;
  return result.ok ? <FieldSuccess role="status">{result.message}</FieldSuccess> : <FieldError role="alert">{result.message}</FieldError>;
}

const STAGE_TONE: Record<ImplantationStatus, ErpTone> = {
  awaiting_documents: "warning", review: "warning", submitted: "info", operator_pending: "warning",
  implanted: "success", refused: "danger", cancelled: "neutral",
};

function StageBadge({ stage }: { stage: ImplantationStatus }) {
  return <ErpStatus tone={STAGE_TONE[stage] ?? "neutral"}>{IMPLANTATION_LABELS[stage]}</ErpStatus>;
}

function ImplantationHistory({ row }: { row: Row }) {
  return <section aria-label="Histórico da implantação" className="flex flex-col gap-2">
    <h3 className="text-sm font-medium">Histórico</h3>
    {row.history.length ? <ul className="flex flex-col gap-2">{row.history.map((item) => <li key={item.id} className="text-sm">
      <span className="font-medium">{item.status ? IMPLANTATION_LABELS[item.status] : "Etapa atualizada"}</span>
      <span className="text-muted-foreground"> · {item.actor ?? "Responsável registrado"} · {formatMoment(item.createdAt)}{item.reviewedImport ? " · via importação" : ""}</span>
    </li>)}</ul> : <ErpNote>Nenhuma conferência registrada para este negócio.</ErpNote>}
  </section>;
}

function ImplantationForm({ row, workspace, onSaved }: { row: Row; workspace: Workspace; onSaved: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ErpActionResult>(INITIAL);
  const [uploadResult, setUploadResult] = useState<ErpActionResult>(INITIAL);
  const [editor, setEditor] = useState<Editor>(() => editorFor(row));
  const [uploaded, setUploaded] = useState<{ id: string; fileName: string } | null>(null);
  const evidence = workspace.evidence.filter((document) => document.leadId === row.leadId);
  const evidenceOptions = [...new Map([...evidence, ...(uploaded ? [uploaded] : [])].map((item) => [item.id, item])).values()];
  const nativeDocuments = workspace.nativeDocuments.filter((document) => document.leadId === row.leadId);
  const stages = availableImplantationStages(row.stage)
    .filter((status) => status !== "implanted" || workspace.canApproveDocument || row.stage === "implanted")
    .map((status) => ({ value: status, label: IMPLANTATION_LABELS[status] }));
  const prefix = `implant-${row.leadId}`;
  const update = (patch: Partial<Editor>) => setEditor((current) => ({ ...current, ...patch }));

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const response = await saveImplantationAction(INITIAL, form);
      setResult(response);
      if (response.ok) {
        onSaved();
        router.refresh();
      }
    });
  }
  function selectEvidence(id: string, fileName: string) {
    setUploaded({ id, fileName });
    update({ evidenceId: id });
    router.refresh();
  }
  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const file = form.get("file");
    form.set("module", "implantations");
    startTransition(async () => {
      const response = await submitErpFile("/api/erp/evidence", form);
      setUploadResult(response);
      if (response.ok && response.id) {
        selectEvidence(response.id, file instanceof File ? file.name : "Evidência enviada");
        element.reset();
      }
    });
  }
  function adopt(documentId: string) {
    const form = new FormData();
    form.set("leadId", row.leadId);
    form.set("documentId", documentId);
    startTransition(async () => {
      const response = await adoptImplantationEvidenceAction(form);
      setUploadResult(response);
      if (response.ok && response.id) selectEvidence(response.id, nativeDocuments.find((document) => document.id === documentId)?.fileName ?? "Documento do CRM");
    });
  }

  return <>
    <form onSubmit={save} className="flex flex-col gap-4" aria-label="Conferência da implantação">
      <input type="hidden" name="leadId" value={row.leadId} />
      <input type="hidden" name="version" value={editor.version} />
      <Field><FieldLabel htmlFor={`${prefix}-status`}>Etapa</FieldLabel>
        <AppSelect id={`${prefix}-status`} name="status" value={editor.stage} disabled={pending} options={stages}
          onValueChange={(value) => { const stage = IMPLANTATION_STATUSES.find((candidate) => candidate === value); if (stage) update({ stage }); }} /></Field>
      <Field><FieldLabel htmlFor={`${prefix}-reference`}>Referência ou protocolo</FieldLabel>
        <Input id={`${prefix}-reference`} name="reference" value={editor.reference} maxLength={100} disabled={pending}
          onChange={(event) => update({ reference: event.target.value })} /></Field>
      <Field><FieldLabel htmlFor={`${prefix}-policy`}>Número da apólice ou contrato</FieldLabel>
        <Input id={`${prefix}-policy`} name="policyNumber" value={editor.policyNumber} required={editor.stage === "implanted"} maxLength={100} disabled={pending}
          onChange={(event) => update({ policyNumber: event.target.value })} /></Field>
      <Field><FieldLabel htmlFor={`${prefix}-coverage`}>Início da cobertura</FieldLabel>
        <Input id={`${prefix}-coverage`} name="coverageStartsOn" type="date" value={editor.coverageStartsOn} required={editor.stage === "implanted"} disabled={pending}
          onChange={(event) => update({ coverageStartsOn: event.target.value })} /></Field>
      <Field><FieldLabel htmlFor={`${prefix}-evidence`}>Evidência da operadora</FieldLabel>
        <AppSelect id={`${prefix}-evidence`} name="evidenceDocumentId" value={editor.evidenceId} required={editor.stage === "implanted"} disabled={pending}
          placeholder="Selecione uma evidência enviada" options={evidenceOptions.map((document) => ({ value: document.id, label: document.fileName }))}
          onValueChange={(value) => update({ evidenceId: value })} /></Field>
      <Field><FieldLabel htmlFor={`${prefix}-reason`}>Pendência ou motivo da mudança</FieldLabel>
        <Textarea id={`${prefix}-reason`} name="reason" value={editor.reason} maxLength={500} disabled={pending}
          onChange={(event) => update({ reason: event.target.value })} /></Field>
      <ErpNote>Recusa, cancelamento e reabertura exigem motivo. Para confirmar implantação, apólice, início de cobertura e evidência são obrigatórios.</ErpNote>
      <Feedback result={result} />
      <div><Button type="submit" loading={pending}>Salvar conferência</Button></div>
    </form>
    <section aria-label="Evidência da operadora" className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">Adicionar evidência</h3>
      <form onSubmit={upload} className="flex flex-col gap-3">
        <input type="hidden" name="leadId" value={row.leadId} />
        <Field><FieldLabel htmlFor={`${prefix}-file`}>PDF, PNG ou JPEG de até 5 MB</FieldLabel>
          <Input id={`${prefix}-file`} name="file" type="file" accept="application/pdf,image/png,image/jpeg" required disabled={pending} /></Field>
        <div><Button type="submit" variant="outline" loading={pending}>Enviar evidência</Button></div>
      </form>
      {nativeDocuments.length ? <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Documentos já aprovados no CRM</p>
        <ul className="flex flex-col gap-2">{nativeDocuments.map((document) => <li key={document.id} className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-sm">{document.fileName}</span>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => adopt(document.id)}>Usar</Button>
        </li>)}</ul>
      </div> : null}
      <Feedback result={uploadResult} />
    </section>
  </>;
}

function ImplantationSummary({ row }: { row: Row }) {
  return <dl className="grid grid-cols-2 gap-3 text-sm">
    <div><dt className="text-xs text-muted-foreground">Etapa</dt><dd><StageBadge stage={row.stage} /></dd></div>
    <div><dt className="text-xs text-muted-foreground">Corretor</dt><dd>{row.brokerName ?? "A definir no CRM"}</dd></div>
    <div><dt className="text-xs text-muted-foreground">Apólice</dt><dd>{row.policyNumber || "A confirmar"}</dd></div>
    <div><dt className="text-xs text-muted-foreground">Início da cobertura</dt><dd>{formatDay(row.coverageStartsOn) ?? "A confirmar"}</dd></div>
    <div className="col-span-2"><dt className="text-xs text-muted-foreground">Pendência</dt><dd>{row.reason || "Nenhuma pendência registrada"}</dd></div>
  </dl>;
}

function ImplantationDetails({ row, workspace, onSaved }: { row: Row; workspace: Workspace; onSaved: () => void }) {
  return <>
    <ImplantationSummary row={row} />
    {workspace.canManage ? <ImplantationForm row={row} workspace={workspace} onSaved={onSaved} /> : null}
    <div className="flex flex-wrap gap-2">
      {row.canOpenLead ? <Button variant="outline" render={<Link href={`/leads/${row.leadId}`} />}>Abrir negócio</Button> : null}
      {row.evidenceId ? <Button variant="ghost" render={<a href={`/api/erp/documents/${row.evidenceId}`} />}>Baixar evidência conferida</Button> : null}
    </div>
    {!row.canOpenLead ? <ErpNote>O cadastro e o registro final do contrato ficam com a pessoa autorizada no CRM.</ErpNote> : null}
    {workspace.canManage ? <Field><FieldLabel htmlFor={`implant-${row.leadId}-code`}>Código do negócio para importação</FieldLabel>
      <Input id={`implant-${row.leadId}-code`} value={row.leadId} readOnly /></Field> : null}
    <ImplantationHistory row={row} />
  </>;
}

export function ImplantationsWorkspace({ workspace }: { workspace: Workspace }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const selected = workspace.rows.find((row) => row.leadId === selectedId) ?? null;
  const counts = workspace.counts;
  const columns: ErpColumn<Row>[] = [
    { id: "deal", label: "Negócio", primary: true, render: (row) => <ErpCell title={row.name} sub={row.brokerName ?? "Corretor a definir"} /> },
    { id: "stage", label: "Etapa", render: (row) => <StageBadge stage={row.stage} /> },
    { id: "reference", label: "Protocolo e apólice", secondary: true, render: (row) => <ErpCell title={row.policyNumber || "Apólice a informar"} sub={row.reference ? `Protocolo ${row.reference}` : undefined} /> },
    { id: "coverage", label: "Início da cobertura", nowrap: true, render: (row) => formatDay(row.coverageStartsOn) ?? "A confirmar" },
    { id: "updated", label: "Atualização", nowrap: true, render: (row) => row.updatedAt ? formatMoment(row.updatedAt) : "Sem conferência" },
  ];
  function openRow(row: Row) {
    setSelectedId(row.leadId);
    setOpen(true);
  }
  return <>
    <ErpStats>
      <StatCard label="A conferir" value={counts.review + counts.awaiting_documents} sublabel="inclui aguardando documentos" />
      <StatCard label="Na operadora" value={counts.submitted + counts.operator_pending} sublabel="enviadas ou com pendência" />
      <StatCard label="Implantadas" value={counts.implanted} sublabel="cobertura confirmada" />
      <StatCard label="Encerradas" value={counts.refused + counts.cancelled} sublabel="recusadas ou canceladas" />
    </ErpStats>
    <ErpToolbar>
      <ErpSearch label="Buscar implantação" placeholder="Buscar negócio, protocolo ou apólice" value={workspace.filters.q} />
      <ErpUrlFilter label="Etapa de implantação" param="status" value={workspace.filters.status} defaultValue="all" options={STATUS_OPTIONS} />
    </ErpToolbar>
    <ErpList title="Fila de implantação" count={workspace.total} countLabel={["negócio", "negócios"]} columns={columns} rows={workspace.rows}
      rowKey={(row) => row.leadId} onRowOpen={openRow} emptyTitle="Nenhuma implantação nesta busca"
      emptyText="Os negócios em fechamento ou convertidos entram nesta fila. Ajuste os filtros ou confira o andamento no CRM."
      footer={<ErpPager page={workspace.filters.page} total={workspace.total} pageSize={workspace.pageSize} label="Paginação de implantações" />} />
    <ErpPanel open={open && !!selected} onOpenChange={setOpen} title={selected?.name ?? "Implantação"}
      description={selected ? `${IMPLANTATION_LABELS[selected.stage]} · ${selected.brokerName ?? "Corretor a definir"}` : undefined}>
      {selected ? <ImplantationDetails key={`${selected.leadId}-${selected.version}`} row={selected} workspace={workspace} onSaved={() => setOpen(false)} /> : null}
    </ErpPanel>
  </>;
}
