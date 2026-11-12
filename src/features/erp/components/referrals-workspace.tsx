"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AppSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel, FieldSuccess } from "@/components/ui/field";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { changeReferralStatusAction, linkReferralLeadAction, registerReferralAction, searchReferralLeadsAction, type ReferralActionResult, type ReferralLeadOption } from "../referral-actions";
import type { getReferrals } from "../referrals";
import page from "@/components/lite/page/lite-page.module.css";

type Workspace = Awaited<ReturnType<typeof getReferrals>>;
type Row = Workspace["rows"][number];
const INITIAL: ReferralActionResult = { ok: true, message: "" };
const NONE = "none";
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const formatDateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

function Feedback({ result }: { result: ReferralActionResult }) {
  if (!result.message) return null;
  if (result.ok) return <FieldSuccess role="status">{result.message}</FieldSuccess>;
  return <FieldError role="alert">{result.message}{result.href ? <> <Link href={result.href} className={page.cellLink}>Abrir registro existente</Link></> : null}</FieldError>;
}

function statusVariant(status: Row["status"]) {
  return status === "converted" ? "default" : status === "lost" || status === "duplicate" ? "outline" : "secondary";
}

export function NewReferralButton({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ReferralActionResult>(INITIAL);
  const [requestId, setRequestId] = useState("");
  const [form, setForm] = useState({ channel: "cliente", referrerUserId: NONE, ownerId: workspace.currentUserId, consent: false });
  if (!workspace.canManage) return null;
  const memberOptions = workspace.members.map((member) => ({ value: member.id, label: member.name }));

  function start() { setRequestId(crypto.randomUUID()); setResult(INITIAL); setForm({ channel: "cliente", referrerUserId: NONE, ownerId: workspace.currentUserId, consent: false }); setOpen(true); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    startTransition(async () => { const response = await registerReferralAction(INITIAL, data); setResult(response); if (response.ok) { setOpen(false); router.refresh(); } });
  }
  return <>
    <Button className={page.toolbarEnd} onClick={start}>Nova indicação</Button>
    <Sheet open={open} onOpenChange={setOpen}><SheetContent><SheetHeader><SheetTitle>Nova indicação</SheetTitle><SheetDescription>Registre quem indicou e os dados mínimos do contato. O sistema confere se o contato já existe antes de salvar.</SheetDescription></SheetHeader>
      <SheetBody contentClassName={page.stack}><form onSubmit={submit} className={page.group}>
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="referrerUserId" value={form.referrerUserId === NONE ? "" : form.referrerUserId} />
        <input type="hidden" name="consent" value={form.consent ? "on" : ""} />
        <Field><FieldLabel htmlFor="referral-referrer">Quem indicou</FieldLabel><Input id="referral-referrer" name="referrerName" required minLength={2} maxLength={120} disabled={pending} /></Field>
        <Field><FieldLabel htmlFor="referral-referrer-member">Indicador da equipe (opcional)</FieldLabel><AppSelect id="referral-referrer-member" value={form.referrerUserId} disabled={pending} onValueChange={(value) => setForm((current) => ({ ...current, referrerUserId: value }))} options={[{ value: NONE, label: "Não é da equipe" }, ...memberOptions]} /></Field>
        <Field><FieldLabel htmlFor="referral-referrer-contact">Contato de quem indicou (opcional)</FieldLabel><Input id="referral-referrer-contact" name="referrerContact" maxLength={120} disabled={pending} /></Field>
        <Field><FieldLabel htmlFor="referral-channel">Canal</FieldLabel><AppSelect id="referral-channel" name="channel" value={form.channel} disabled={pending} onValueChange={(value) => setForm((current) => ({ ...current, channel: value }))} options={workspace.channelOptions} /></Field>
        <Field><FieldLabel htmlFor="referral-name">Nome da pessoa indicada</FieldLabel><Input id="referral-name" name="referredName" required minLength={2} maxLength={120} disabled={pending} /></Field>
        <Field><FieldLabel htmlFor="referral-phone">Telefone com DDD</FieldLabel><Input id="referral-phone" name="referredPhone" type="tel" inputMode="tel" autoComplete="off" required maxLength={30} disabled={pending} /></Field>
        <label className="flex items-start gap-2 text-sm"><Checkbox checked={form.consent} disabled={pending} onCheckedChange={(checked) => setForm((current) => ({ ...current, consent: checked === true }))} /><span>A pessoa indicada autorizou o contato</span></label>
        {workspace.canAssignOwner ? <Field><FieldLabel htmlFor="referral-owner">Responsável</FieldLabel><AppSelect id="referral-owner" name="ownerId" value={form.ownerId} disabled={pending} onValueChange={(value) => setForm((current) => ({ ...current, ownerId: value }))} options={memberOptions.some((option) => option.value === workspace.currentUserId) ? memberOptions : [{ value: workspace.currentUserId, label: "Eu" }, ...memberOptions]} /></Field> : null}
        <Field><FieldLabel htmlFor="referral-notes">Observações (opcional)</FieldLabel><Textarea id="referral-notes" name="notes" maxLength={1000} disabled={pending} /></Field>
        <Feedback result={result} /><Button type="submit" loading={pending}>Registrar indicação</Button>
      </form></SheetBody></SheetContent></Sheet>
  </>;
}

function LeadPicker({ prefix, disabled, selected, onSelect }: { prefix: string; disabled: boolean; selected: ReferralLeadOption | null; onSelect: (lead: ReferralLeadOption) => void }) {
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<ReferralLeadOption[] | null>(null);
  const [message, setMessage] = useState("");
  const [searching, startSearch] = useTransition();
  function search() {
    startSearch(async () => { const response = await searchReferralLeadsAction(query); if (response.ok) { setLeads(response.leads); setMessage(response.leads.length ? "" : "Nenhum negócio encontrado no seu escopo."); } else { setLeads([]); setMessage(response.message); } });
  }
  return <div className={page.group}>
    <Field><FieldLabel htmlFor={`${prefix}-lead-search`}>Buscar negócio por nome ou telefone</FieldLabel><div className="flex gap-2"><Input id={`${prefix}-lead-search`} value={query} maxLength={100} disabled={disabled} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); search(); } }} /><Button type="button" variant="outline" loading={searching} disabled={disabled || query.trim().length < 2} onClick={search}>Buscar</Button></div></Field>
    {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
    {leads?.length ? <ul className={page.group} aria-label="Negócios encontrados">{leads.map((lead) => <li key={lead.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-sm">{lead.name}{lead.phoneEnd ? ` · final ${lead.phoneEnd}` : ""}</span><Button type="button" variant={selected?.id === lead.id ? "secondary" : "outline"} disabled={disabled} aria-pressed={selected?.id === lead.id} onClick={() => onSelect(lead)}>{selected?.id === lead.id ? "Selecionado" : "Selecionar"}</Button></li>)}</ul> : null}
  </div>;
}

function ReferralSheet({ row, open, onOpenChange }: { row: Row; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [statusResult, setStatusResult] = useState<ReferralActionResult>(INITIAL);
  const [linkResult, setLinkResult] = useState<ReferralActionResult>(INITIAL);
  const [nextStatus, setNextStatus] = useState<string>(row.nextStatuses[0]?.value ?? "");
  const [duplicateOf, setDuplicateOf] = useState<ReferralLeadOption | null>(null);
  const [lead, setLead] = useState<ReferralLeadOption | null>(null);
  const prefix = `referral-${row.id}`;
  const reasonRequired = nextStatus === "lost" || ["lost", "duplicate"].includes(row.status);

  function run(event: FormEvent<HTMLFormElement>, action: typeof changeReferralStatusAction, setResult: (result: ReferralActionResult) => void) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    startTransition(async () => { const response = await action(INITIAL, data); setResult(response); if (response.ok) router.refresh(); });
  }
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent><SheetHeader><SheetTitle>{row.referredName}</SheetTitle><SheetDescription>Indicação de {row.referrerName} · {row.channelLabel} · {row.statusLabel}</SheetDescription></SheetHeader>
    <SheetBody contentClassName={page.stack}>
      <dl className={page.group}>
        <div><dt className={page.statLabel}>Telefone</dt><dd>{row.referredPhone}</dd></div>
        <div><dt className={page.statLabel}>Consentimento de contato</dt><dd>{row.consent ? "Autorizado" : "Não registrado"}</dd></div>
        <div><dt className={page.statLabel}>Responsável</dt><dd>{row.ownerName ?? "Não informado"}</dd></div>
        {row.referrerContact ? <div><dt className={page.statLabel}>Contato de quem indicou</dt><dd>{row.referrerContact}</dd></div> : null}
        <div><dt className={page.statLabel}>Negócio vinculado</dt><dd>{row.leadId ? row.canOpenLead ? <Link href={`/leads/${row.leadId}`} className={page.cellLink}>{row.leadName ?? "Abrir negócio"}</Link> : row.leadName ?? "Negócio fora do seu acesso" : "Nenhum"}</dd></div>
        {row.lostReason ? <div><dt className={page.statLabel}>Motivo da perda</dt><dd>{row.lostReason}</dd></div> : null}
        {row.notes ? <div><dt className={page.statLabel}>Observações</dt><dd className="whitespace-pre-wrap">{row.notes}</dd></div> : null}
      </dl>
      {row.nextStatuses.length ? <section className={page.group}><h3 className={page.sectionTitle}>Mudar etapa</h3><form onSubmit={(event) => run(event, changeReferralStatusAction, setStatusResult)} className={page.group}>
        <input type="hidden" name="id" value={row.id} /><input type="hidden" name="version" value={row.version} /><input type="hidden" name="leadId" value={nextStatus === "duplicate" ? duplicateOf?.id ?? "" : ""} />
        <Field><FieldLabel htmlFor={`${prefix}-status`}>Nova etapa</FieldLabel><AppSelect id={`${prefix}-status`} name="status" value={nextStatus} disabled={pending} onValueChange={setNextStatus} options={row.nextStatuses} /></Field>
        {nextStatus === "duplicate" ? <><FieldDescription>Selecione o negócio que já existe para este contato.</FieldDescription><LeadPicker prefix={`${prefix}-dup`} disabled={pending} selected={duplicateOf} onSelect={setDuplicateOf} /></> : null}
        <Field><FieldLabel htmlFor={`${prefix}-reason`}>{reasonRequired ? "Motivo" : "Motivo (opcional)"}</FieldLabel><Textarea id={`${prefix}-reason`} name="reason" required={reasonRequired} minLength={reasonRequired ? 5 : undefined} maxLength={500} disabled={pending} /></Field>
        {nextStatus === "contacting" && !row.consent ? <FieldDescription>O contato só pode começar com o consentimento registrado.</FieldDescription> : null}
        {nextStatus === "converted" ? <FieldDescription>A conversão exige o negócio vinculado convertido ou com venda ativa no CRM.</FieldDescription> : null}
        <Feedback result={statusResult} /><Button type="submit" variant="outline" loading={pending} disabled={nextStatus === "duplicate" && !duplicateOf}>Salvar etapa</Button>
      </form></section> : null}
      {row.canLink ? <section className={page.group}><h3 className={page.sectionTitle}>{row.leadId ? "Trocar negócio vinculado" : "Vincular negócio"}</h3>
        <p className="text-sm text-muted-foreground">A indicação não cria negócios automaticamente. Crie o negócio em <Link href="/leads" className={page.cellLink}>Leads</Link> e depois vincule aqui.</p>
        <form onSubmit={(event) => run(event, linkReferralLeadAction, setLinkResult)} className={page.group}>
          <input type="hidden" name="id" value={row.id} /><input type="hidden" name="version" value={row.version} /><input type="hidden" name="leadId" value={lead?.id ?? ""} />
          <LeadPicker prefix={`${prefix}-link`} disabled={pending} selected={lead} onSelect={setLead} />
          <Feedback result={linkResult} /><Button type="submit" variant="outline" loading={pending} disabled={!lead}>Vincular negócio</Button>
        </form></section> : null}
      <section className={page.group} aria-label="Histórico da indicação"><h3 className={page.sectionTitle}>Histórico</h3>
        {row.timeline.length ? <ol className={page.group}>{row.timeline.map((event) => <li key={event.id} className="text-sm"><p className="font-medium">{event.label}{event.status ? ` · ${event.status}` : ""}</p><p className="text-muted-foreground">{event.actor} · {formatDateTime(event.createdAt)}</p>{event.reason ? <p>{event.reason}</p> : null}</li>)}</ol>
          : <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>}
      </section>
    </SheetBody></SheetContent></Sheet>;
}

export function ReferralsWorkspace({ workspace }: { workspace: Workspace }) {
  const focusId = workspace.filters.id;
  const [selectedId, setSelectedId] = useState<string | null>(() => focusId && workspace.rows.some((row) => row.id === focusId) ? focusId : null);
  const selected = workspace.rows.find((row) => row.id === selectedId) ?? null;
  return <section className={page.group} aria-label="Lista de indicações">
    {workspace.rows.length ? <Table><TableHeader><TableRow><TableHead>Indicado</TableHead><TableHead>Canal</TableHead><TableHead>Etapa</TableHead><TableHead>Responsável</TableHead><TableHead>Registro</TableHead><TableHead><span className="sr-only">Ação</span></TableHead></TableRow></TableHeader>
      <TableBody>{workspace.rows.map((row) => <TableRow key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.id)}>
        <TableCell><p className={page.cellTitle}>{row.referredName}</p><p className={page.cellSub}>Indicado por {row.referrerName}</p></TableCell>
        <TableCell>{row.channelLabel}</TableCell>
        <TableCell><Badge variant={statusVariant(row.status)}>{row.statusLabel}</Badge></TableCell>
        <TableCell>{row.ownerName ?? "Não informado"}</TableCell>
        <TableCell>{formatDate(row.createdAt)}</TableCell>
        <TableCell><Button variant="outline" onClick={(event) => { event.stopPropagation(); setSelectedId(row.id); }}>Abrir</Button></TableCell>
      </TableRow>)}</TableBody></Table>
      : <div className={page.empty}><h2 className={page.emptyTitle}>{workspace.filters.q || workspace.filters.status !== "all" || workspace.filters.id ? "Nenhuma indicação nesta busca" : "Nenhuma indicação registrada"}</h2><p className={page.emptyText}>{workspace.canManage ? "Use “Nova indicação” para registrar um contato indicado ou ajuste os filtros." : "Ajuste os filtros ou confira com a gestão."}</p></div>}
    {selected ? <ReferralSheet key={`${selected.id}-${selected.version}`} row={selected} open onOpenChange={(open) => { if (!open) setSelectedId(null); }} /> : null}
  </section>;
}
