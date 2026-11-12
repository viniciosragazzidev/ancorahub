"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AppSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Field, FieldError, FieldLabel, FieldSuccess } from "@/components/ui/field";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { availableImplantationStages, IMPLANTATION_LABELS, IMPLANTATION_STATUSES, type ErpActionResult } from "../contracts";
import { adoptImplantationEvidenceAction, saveImplantationAction } from "../implantation-actions";
import { submitErpFile } from "../client-file-request";
import type { getImplantations } from "../implantations";
import page from "@/components/lite/page/lite-page.module.css";

type Workspace = Awaited<ReturnType<typeof getImplantations>>;
type Row = Workspace["rows"][number];
const INITIAL: ErpActionResult = { ok: true, message: "" };

function Feedback({ result }: { result: ErpActionResult }) {
  return result.message ? result.ok ? <FieldSuccess role="status">{result.message}</FieldSuccess> : <FieldError role="alert">{result.message}</FieldError> : null;
}

function ImplantationRow({ row, workspace }: { row: Row; workspace: Workspace }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ErpActionResult>(INITIAL);
  const [uploadResult, setUploadResult] = useState<ErpActionResult>(INITIAL);
  const [editor, setEditor] = useState({ version: row.version, stage: row.stage, reference: row.reference ?? "", policyNumber: row.policyNumber ?? "", coverageStartsOn: row.coverageStartsOn ?? "", reason: row.reason ?? "", evidenceId: row.evidenceId ?? "" });
  const [uploaded, setUploaded] = useState<{ id: string; fileName: string } | null>(null);
  const evidence = workspace.evidence.filter((document) => document.leadId === row.leadId);
  const evidenceOptions = [...new Map([...evidence, ...(uploaded ? [uploaded] : [])].map((item) => [item.id, item])).values()];
  const nativeDocuments = workspace.nativeDocuments.filter((document) => document.leadId === row.leadId);

  function openDetails() {
    setEditor({ version: row.version, stage: row.stage, reference: row.reference ?? "", policyNumber: row.policyNumber ?? "", coverageStartsOn: row.coverageStartsOn ?? "", reason: row.reason ?? "", evidenceId: row.evidenceId ?? "" });
    setResult(INITIAL); setUploadResult(INITIAL); setOpen(true);
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    startTransition(async () => { const response = await saveImplantationAction(INITIAL, form); setResult(response); if (response.ok) { setOpen(false); router.refresh(); } });
  }
  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const element = event.currentTarget; const form = new FormData(element); const file = form.get("file");
    startTransition(async () => {
      form.set("module", "implantations"); const response = await submitErpFile("/api/erp/evidence", form); setUploadResult(response);
      if (response.ok && response.id) { setUploaded({ id: response.id, fileName: file instanceof File ? file.name : "Evidência enviada" }); setEditor((current) => ({ ...current, evidenceId: response.id ?? "" })); element.reset(); router.refresh(); }
    });
  }
  function adopt(documentId: string) {
    const form = new FormData(); form.set("leadId", row.leadId); form.set("documentId", documentId);
    startTransition(async () => { const response = await adoptImplantationEvidenceAction(form); setUploadResult(response); if (response.ok && response.id) { const fileName = nativeDocuments.find((document) => document.id === documentId)?.fileName ?? "Documento do CRM"; setUploaded({ id: response.id, fileName }); setEditor((current) => ({ ...current, evidenceId: response.id ?? "" })); router.refresh(); } });
  }
  const prefix = `implant-${row.leadId}`;
  return <TableRow><TableCell><p className={page.cellTitle}>{row.name}</p>{row.reference ? <p className={page.cellSub}>{row.reference}</p> : null}{!row.brokerId ? <p className={page.cellSub}>Responsável a definir no CRM</p> : null}</TableCell>
    <TableCell><Badge variant={row.stage === "implanted" ? "default" : "secondary"}>{IMPLANTATION_LABELS[row.stage]}</Badge></TableCell>
    <TableCell>{row.coverageStartsOn ? row.coverageStartsOn.split("-").reverse().join("/") : "A confirmar"}</TableCell>
    <TableCell>{row.updatedAt ? new Date(row.updatedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Sem conferência registrada"}</TableCell>
    <TableCell><Button variant="outline" onClick={openDetails}>{workspace.canManage ? "Conferir" : "Ver detalhes"}</Button>
      <Sheet open={open} onOpenChange={setOpen}><SheetContent><SheetHeader><SheetTitle>{row.name}</SheetTitle><SheetDescription>Confira a resposta da operadora e registre a etapa. O contrato final continua usando o cadastro e os documentos do CRM.</SheetDescription></SheetHeader><SheetBody contentClassName={page.stack}>
        {workspace.canManage ? <>
          <form onSubmit={save} className={page.group}>
            <input type="hidden" name="leadId" value={row.leadId} /><input type="hidden" name="version" value={editor.version} />
            <Field><FieldLabel htmlFor={`${prefix}-status`}>Etapa</FieldLabel><AppSelect id={`${prefix}-status`} name="status" value={editor.stage} disabled={pending} onValueChange={(value) => { const stage = IMPLANTATION_STATUSES.find((candidate) => candidate === value); if (stage) setEditor((current) => ({ ...current, stage })); }}
              options={availableImplantationStages(row.stage).filter((status) => status !== "implanted" || workspace.canApproveDocument || row.stage === "implanted").map((status) => ({ value: status, label: IMPLANTATION_LABELS[status] }))} /></Field>
            <Field><FieldLabel htmlFor={`${prefix}-reference`}>Referência ou protocolo</FieldLabel><Input id={`${prefix}-reference`} name="reference" value={editor.reference} maxLength={100} disabled={pending} onChange={(event) => setEditor((current) => ({ ...current, reference: event.target.value }))} /></Field>
            <Field><FieldLabel htmlFor={`${prefix}-policy`}>Número da apólice ou contrato</FieldLabel><Input id={`${prefix}-policy`} name="policyNumber" value={editor.policyNumber} required={editor.stage === "implanted"} maxLength={100} disabled={pending} onChange={(event) => setEditor((current) => ({ ...current, policyNumber: event.target.value }))} /></Field>
            <Field><FieldLabel htmlFor={`${prefix}-coverage`}>Início da cobertura</FieldLabel><Input id={`${prefix}-coverage`} name="coverageStartsOn" type="date" value={editor.coverageStartsOn} required={editor.stage === "implanted"} disabled={pending} onChange={(event) => setEditor((current) => ({ ...current, coverageStartsOn: event.target.value }))} /></Field>
            <Field><FieldLabel htmlFor={`${prefix}-evidence`}>Evidência da operadora</FieldLabel><AppSelect id={`${prefix}-evidence`} name="evidenceDocumentId" value={editor.evidenceId} required={editor.stage === "implanted"} disabled={pending} placeholder="Selecione uma evidência enviada" options={evidenceOptions.map((document) => ({ value: document.id, label: document.fileName }))} onValueChange={(value) => setEditor((current) => ({ ...current, evidenceId: value }))} /></Field>
            <Field><FieldLabel htmlFor={`${prefix}-reason`}>Pendência ou motivo da mudança</FieldLabel><Textarea id={`${prefix}-reason`} name="reason" value={editor.reason} maxLength={500} disabled={pending} onChange={(event) => setEditor((current) => ({ ...current, reason: event.target.value }))} /></Field>
            <p className="text-sm text-muted-foreground">Recusa, cancelamento e reabertura exigem motivo. Para confirmar implantação, apólice, início de cobertura e evidência são obrigatórios.</p>
            <Feedback result={result} /><Button type="submit" loading={pending}>Salvar conferência</Button>
          </form>
          <section className={page.group}><h3 className={page.sectionTitle}>Adicionar evidência</h3><form onSubmit={upload} className={page.group}><input type="hidden" name="leadId" value={row.leadId} /><Field><FieldLabel htmlFor={`${prefix}-file`}>PDF, PNG ou JPEG de até 5 MB</FieldLabel><Input id={`${prefix}-file`} name="file" type="file" accept="application/pdf,image/png,image/jpeg" required disabled={pending} /></Field><Button type="submit" variant="outline" loading={pending}>Enviar evidência</Button></form>
            {nativeDocuments.length ? <details><summary className="cursor-pointer text-sm font-medium">Usar documento já aprovado no CRM</summary><ul className={page.group}>{nativeDocuments.map((document) => <li key={document.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-sm">{document.fileName}</span><Button type="button" variant="outline" disabled={pending} onClick={() => adopt(document.id)}>Usar</Button></li>)}</ul></details> : null}<Feedback result={uploadResult} />
          </section>
        </> : <dl className={page.group}><div><dt className={page.statLabel}>Etapa</dt><dd>{IMPLANTATION_LABELS[row.stage]}</dd></div><div><dt className={page.statLabel}>Apólice</dt><dd>{row.policyNumber || "A confirmar"}</dd></div><div><dt className={page.statLabel}>Pendência</dt><dd>{row.reason || "Nenhuma pendência registrada"}</dd></div></dl>}
        {row.evidenceId ? <a href={`/api/erp/documents/${row.evidenceId}`} className={page.cellLink}>Baixar evidência conferida</a> : null}
        {row.canOpenLead ? <Link href={`/leads/${row.leadId}`} className={page.cellLink}>Abrir cadastro e registro do contrato</Link> : <p className="text-sm text-muted-foreground">O cadastro e o registro final ficam com a pessoa autorizada no CRM.</p>}
        {workspace.canManage ? <Field><FieldLabel htmlFor={`${prefix}-code`}>Código do negócio para importação</FieldLabel><Input id={`${prefix}-code`} value={row.leadId} readOnly /></Field> : null}
      </SheetBody></SheetContent></Sheet>
    </TableCell></TableRow>;
}

export function ImplantationsWorkspace({ workspace }: { workspace: Workspace }) {
  return <section className={page.group} aria-label="Fila de implantação">{workspace.rows.length ? <Table><TableHeader><TableRow><TableHead>Negócio</TableHead><TableHead>Etapa</TableHead><TableHead>Cobertura</TableHead><TableHead>Atualização</TableHead><TableHead>Ação</TableHead></TableRow></TableHeader><TableBody>{workspace.rows.map((row) => <ImplantationRow key={row.leadId} row={row} workspace={workspace} />)}</TableBody></Table>
    : <div className={page.empty}><h2 className={page.emptyTitle}>Nenhuma implantação nesta busca</h2><p className={page.emptyText}>Os negócios em fechamento ou convertidos entram nesta fila. Ajuste os filtros ou confira o andamento no CRM.</p></div>}</section>;
}
