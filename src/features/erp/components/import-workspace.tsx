"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel, FieldSuccess } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FINANCIAL_LABELS, IMPLANTATION_LABELS, IMPORT_STATUS, formatCents, type ErpActionResult } from "../contracts";
import { AppSelect } from "@/components/ui/select";
import { submitErpFile } from "../client-file-request";
import { reviewErpImportAction } from "../import-actions";
import type { getErpImport } from "../imports";
import page from "@/components/lite/page/lite-page.module.css";

const INITIAL: ErpActionResult = { ok: true, message: "" };

export function ImportUpload({ maxRows, domains }: { maxRows: number; domains: readonly ("implantations" | "finance")[] }) {
  const router = useRouter(); const [pending, startTransition] = useTransition(); const [result, setResult] = useState(INITIAL); const [domain, setDomain] = useState<string>(domains[0] ?? "implantations");
  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); form.set("domain", domain);
    startTransition(async () => { const response = await submitErpFile("/api/erp/imports", form); setResult(response); if (response.ok && response.id) router.push(`/administracao/importacoes/${response.id}`); });
  }
  const finance = domain === "finance";
  return <form onSubmit={preview} className={page.group}>{domains.length > 1 ? <Field><FieldLabel htmlFor="erp-import-domain">Tipo de importação</FieldLabel><AppSelect id="erp-import-domain" value={domain} onValueChange={(value) => { setDomain(value); setResult(INITIAL); }} options={domains.map((value) => ({ value, label: value === "finance" ? "Lançamentos financeiros" : "Implantação" }))} /></Field> : null}
    <Field><FieldLabel htmlFor="erp-import-file">{finance ? "Arquivo de lançamentos" : "Arquivo de implantação"}</FieldLabel><Input id="erp-import-file" name="file" type="file" accept=".csv,.xlsx" required disabled={pending} /><p className="text-sm text-muted-foreground">CSV UTF-8 ou XLSX, até 2 MB e {maxRows} linhas. Nenhuma linha será aplicada durante a prévia.{finance ? " Cada linha vira um lançamento a conferir: a evidência e a aprovação continuam na ficha do lançamento." : " Use o código do negócio disponível em Implantação."}</p></Field>
    {result.message ? result.ok ? <FieldSuccess>{result.message}</FieldSuccess> : <FieldError>{result.message}</FieldError> : null}
    <div className="flex flex-wrap gap-2"><Button type="submit" loading={pending}>Preparar prévia</Button><Button variant="outline" render={<a href={finance ? "/api/erp/imports/template?domain=finance" : "/api/erp/imports/template"} />}>Baixar modelo</Button><Button variant="ghost" render={<Link href={finance ? "/financeiro" : "/implantacoes"} />}>{finance ? "Ver lançamentos" : "Ver negócios"}</Button></div>
    <details><summary className="cursor-pointer text-sm font-medium">Como preencher o modelo</summary>{finance ? <p className="text-sm text-muted-foreground">Datas: AAAA-MM-DD; competência: AAAA-MM. Tipo: recebível, mensalidade, comissão, despesa ou adiantamento. Valor com vírgula ou ponto e até duas casas. Recebível, mensalidade e comissão exigem o código da venda; comissão e adiantamento exigem o código do beneficiário. A referência é única por tipo: reenviar a mesma referência não duplica o lançamento.</p> : <p className="text-sm text-muted-foreground">Datas: AAAA-MM-DD. Etapas: awaiting_documents, review, submitted, operator_pending, implanted, refused ou cancelled. Para confirmar implantação, informe apólice, início de cobertura e o código da evidência enviada pelo módulo. Recusa, cancelamento e reabertura exigem motivo.</p>}</details>
  </form>;
}

export function ImportReview({ batch }: { batch: Awaited<ReturnType<typeof getErpImport>> }) {
  const [result, action, pending] = useActionState(reviewErpImportAction, INITIAL);
  return <><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{IMPORT_STATUS[batch.status]}</Badge><p className="text-sm text-muted-foreground">Versão {batch.version} · {batch.rows.length + batch.financeRows.length} linha(s)</p></div>
    {batch.domain === "finance" ? <Table><TableHeader><TableRow><TableHead>Referência</TableHead><TableHead>Tipo</TableHead><TableHead className={page.numeric}>Valor</TableHead><TableHead>Vencimento</TableHead><TableHead>Competência</TableHead></TableRow></TableHeader><TableBody>{batch.financeRows.map((row) => <TableRow key={`${row.kind}-${row.reference}`}><TableCell>{row.reference}<p className={page.cellSub}>{row.description}</p></TableCell><TableCell>{FINANCIAL_LABELS[row.kind]}</TableCell><TableCell className={page.numeric}>{formatCents(row.amountCents)}</TableCell><TableCell>{row.dueOn.split("-").reverse().join("/")}</TableCell><TableCell>{row.competence}</TableCell></TableRow>)}</TableBody></Table> : null}
    {batch.domain === "implantations" ? <Table><TableHeader><TableRow><TableHead>Negócio</TableHead><TableHead>Etapa</TableHead><TableHead>Apólice</TableHead><TableHead>Cobertura</TableHead><TableHead>Conferência</TableHead></TableRow></TableHeader><TableBody>{batch.rows.map((row) => <TableRow key={row.leadId}><TableCell>{row.leadId}<p className={page.cellSub}>{row.reference}</p></TableCell><TableCell>{IMPLANTATION_LABELS[row.status]}</TableCell><TableCell>{row.policyNumber || "A informar"}</TableCell><TableCell>{row.coverageStartsOn || "A informar"}</TableCell><TableCell>Versão {row.expectedVersion}<p className={page.cellSub}>{row.evidenceDocumentId ? "Evidência vinculada" : "Sem evidência"}</p></TableCell></TableRow>)}</TableBody></Table> : null}
    {batch.reviewReason ? <p className="text-sm text-muted-foreground">Última revisão: {batch.reviewReason}</p> : null}
    {batch.status !== "applied" ? <form action={action} className={page.group}><input type="hidden" name="id" value={batch.id} /><input type="hidden" name="version" value={batch.version} /><Field><FieldLabel htmlFor="erp-import-reason">Motivo da revisão</FieldLabel><Textarea id="erp-import-reason" name="reason" required minLength={5} maxLength={300} disabled={pending} /></Field><label className="flex items-center gap-2 text-sm"><Checkbox name="confirmed" disabled={pending} />Conferi todas as linhas e os documentos vinculados</label>
      {!batch.canApprove ? <p className="text-sm text-muted-foreground">A aplicação precisa ser feita por outra pessoa autorizada. Você pode atualizar a prévia ou rejeitar este lote.</p> : null}
      {result.message ? result.ok ? <FieldSuccess>{result.message}</FieldSuccess> : <FieldError>{result.message}</FieldError> : null}
      <div className="flex flex-wrap gap-2"><Button type="submit" name="decision" value="apply" disabled={pending || !batch.canApprove || batch.status !== "preview"}>Aplicar lote conferido</Button><Button variant="outline" type="submit" name="decision" value="refresh" disabled={pending}>Revalidar prévia</Button><Button variant="outline" type="submit" name="decision" value="reject" disabled={pending}>Rejeitar lote</Button></div>
    </form> : <p className="text-sm text-muted-foreground">Todas as linhas foram aplicadas na mesma transação. Ajustes posteriores devem ser feitos no módulo de origem.</p>}</>;
}
