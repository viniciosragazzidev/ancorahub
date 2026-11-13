"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AppSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel, FieldSuccess } from "@/components/ui/field";
import { SearchAddList, type SearchAddItem } from "@/components/ui/search-add-list";
import { liteStageLabel } from "@/app/(dashboard)/leads/lite-stage-labels";
import {
  changeReferralStatusAction, getReferralTimelineAction, linkReferralLeadAction, registerReferralAction, searchReferralLeadsAction,
  type ReferralActionResult, type ReferralTimeline,
} from "../referral-actions";
import type { getReferrals } from "../referrals";
import { ErpList, ErpPager, ErpPanel, ErpRowMenu, type ErpColumn, type ErpMenuItem } from "../ui/erp-kit";

type Workspace = Awaited<ReturnType<typeof getReferrals>>;
type Row = Workspace["rows"][number];
type Member = Workspace["members"][number];
type Picked = { id: string; label: string };
const INITIAL: ReferralActionResult = { ok: true, message: "" };

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const formatDateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

function Feedback({ result }: { result: ReferralActionResult }) {
  if (!result.message) return null;
  if (result.ok) return <FieldSuccess role="status">{result.message}</FieldSuccess>;
  return <FieldError role="alert">
    {result.message}
    {result.href ? <> <Link href={result.href} className="underline underline-offset-2">Abrir registro existente</Link></> : null}
  </FieldError>;
}

function statusVariant(status: Row["status"]) {
  if (status === "converted") return "success";
  return status === "lost" || status === "duplicate" ? "outline" : "secondary";
}

function Details({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <dl className="grid gap-3">
    {items.map((item) => <div key={item.label}>
      <dt className="text-xs text-muted-foreground">{item.label}</dt>
      <dd className="text-sm whitespace-pre-wrap">{item.value}</dd>
    </div>)}
  </dl>;
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="flex flex-col gap-3" aria-label={title}>
    <h3 className="text-sm font-medium">{title}</h3>
    {children}
  </section>;
}

/** Picked item with a way back to the search ("Trocar"). */
function PickedItem({ item, onClear, disabled }: { item: Picked; onClear: () => void; disabled?: boolean }) {
  return <div className="flex items-center justify-between gap-2">
    <span className="min-w-0 truncate text-sm">{item.label}</span>
    <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onClear}>Trocar</Button>
  </div>;
}

/** Search + "+" over the members already loaded for the viewer's scope. */
function MemberSearchAdd({ members, selected, onSelect, placeholder, disabled, selfId }: {
  members: Member[]; selected: Picked | null; onSelect: (item: Picked | null) => void; placeholder: string; disabled: boolean; selfId?: string;
}) {
  if (selected) return <PickedItem item={selected} disabled={disabled} onClear={() => onSelect(null)} />;
  const items = members.map((member) => ({ id: member.id, label: member.id === selfId ? `${member.name} (você)` : member.name }));
  return <SearchAddList
    items={items}
    placeholder={placeholder}
    emptyLabel="Ninguém com esse nome no seu escopo."
    disabled={disabled}
    onAdd={(item) => onSelect({ id: item.id, label: item.label })}
  />;
}

/** Search + "+" over the CRM with server search; "Só ativos" hides lost leads by default. */
export function LeadSearchAdd({ placeholder, disabled, addingId, onAdd }: {
  placeholder: string; disabled: boolean; addingId?: string | null; onAdd: (lead: Picked) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [items, setItems] = useState<SearchAddItem[]>([]);
  const [message, setMessage] = useState("Nenhum negócio encontrado no seu escopo.");
  const [searching, startSearch] = useTransition();
  const ticket = useRef(0);
  const term = query.trim();
  useEffect(() => {
    if (term.length < 2) return undefined;
    const current = ++ticket.current;
    const timer = setTimeout(() => startSearch(async () => {
      const response = await searchReferralLeadsAction(term, activeOnly);
      if (current !== ticket.current) return;
      if (!response.ok) {
        setItems([]);
        setMessage(response.message);
        return;
      }
      setMessage("Nenhum negócio encontrado no seu escopo.");
      setItems(response.leads.map((lead) => ({
        id: lead.id,
        label: lead.name,
        hint: [lead.phoneEnd ? `final ${lead.phoneEnd}` : null, liteStageLabel(lead.status)].filter(Boolean).join(" · "),
        keywords: term,
      })));
    }), 300);
    return () => clearTimeout(timer);
  }, [term, activeOnly]);
  const emptyLabel = term.length < 2 ? "Digite ao menos 2 letras ou 4 números." : searching ? "Buscando…" : message;
  const toggle = <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => setActiveOnly((value) => !value)}>
    {activeOnly ? "Mostrar todos" : "Só ativos"}
  </Button>;
  return <div onChange={(event) => { if (event.target instanceof HTMLInputElement) setQuery(event.target.value); }}>
    <SearchAddList
      items={term.length < 2 ? [] : items}
      placeholder={placeholder}
      emptyLabel={emptyLabel}
      addingId={addingId}
      disabled={disabled}
      toolbar={toggle}
      onAdd={(item) => onAdd({ id: item.id, label: item.label })}
    />
  </div>;
}

export function NewReferralButton({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ReferralActionResult>(INITIAL);
  const [requestId, setRequestId] = useState("");
  const [channel, setChannel] = useState("cliente");
  const [consent, setConsent] = useState(false);
  const [referrer, setReferrer] = useState<Picked | null>(null);
  const [owner, setOwner] = useState<Picked | null>(null);
  if (!workspace.canManage) return null;
  const self = { id: workspace.currentUserId, label: "Eu" };

  function start() {
    setRequestId(crypto.randomUUID());
    setResult(INITIAL);
    setChannel("cliente");
    setConsent(false);
    setReferrer(null);
    setOwner(self);
    setOpen(true);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const response = await registerReferralAction(INITIAL, data);
      setResult(response);
      if (!response.ok) return;
      setOpen(false);
      router.refresh();
    });
  }
  return <>
    <Button type="button" onClick={start}>Nova indicação</Button>
    <ErpPanel
      open={open}
      onOpenChange={setOpen}
      title="Nova indicação"
      description="Registre quem indicou e os dados mínimos do contato. O sistema confere se o contato já existe antes de salvar."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="referrerUserId" value={referrer?.id ?? ""} />
        <input type="hidden" name="ownerId" value={workspace.canAssignOwner ? owner?.id ?? "" : ""} />
        <input type="hidden" name="consent" value={consent ? "on" : ""} />
        <Field>
          <FieldLabel htmlFor="referral-referrer">Quem indicou</FieldLabel>
          <Input id="referral-referrer" name="referrerName" required minLength={2} maxLength={120} disabled={pending} />
        </Field>
        <Field>
          <FieldLabel>Indicador da equipe (opcional)</FieldLabel>
          <MemberSearchAdd members={workspace.members} selected={referrer} onSelect={setReferrer} placeholder="Buscar pessoa da equipe" disabled={pending} />
        </Field>
        <Field>
          <FieldLabel htmlFor="referral-referrer-contact">Contato de quem indicou (opcional)</FieldLabel>
          <Input id="referral-referrer-contact" name="referrerContact" maxLength={120} disabled={pending} />
        </Field>
        <Field>
          <FieldLabel htmlFor="referral-channel">Canal</FieldLabel>
          <AppSelect id="referral-channel" name="channel" value={channel} disabled={pending} onValueChange={setChannel} options={workspace.channelOptions} />
        </Field>
        <Field>
          <FieldLabel htmlFor="referral-name">Nome da pessoa indicada</FieldLabel>
          <Input id="referral-name" name="referredName" required minLength={2} maxLength={120} disabled={pending} />
        </Field>
        <Field>
          <FieldLabel htmlFor="referral-phone">Telefone com DDD</FieldLabel>
          <Input id="referral-phone" name="referredPhone" type="tel" inputMode="tel" autoComplete="off" required maxLength={30} disabled={pending} />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={consent} disabled={pending} onCheckedChange={(checked) => setConsent(checked === true)} />
          <span>A pessoa indicada autorizou o contato</span>
        </label>
        {workspace.canAssignOwner ? <Field>
          <FieldLabel>Responsável</FieldLabel>
          <MemberSearchAdd
            members={workspace.members}
            selected={owner}
            onSelect={setOwner}
            placeholder="Buscar responsável"
            disabled={pending}
            selfId={workspace.currentUserId}
          />
          {!owner ? <FieldDescription>Sem seleção, você fica como responsável.</FieldDescription> : null}
        </Field> : null}
        <Field>
          <FieldLabel htmlFor="referral-notes">Observações (opcional)</FieldLabel>
          <Textarea id="referral-notes" name="notes" maxLength={1000} disabled={pending} />
        </Field>
        <Feedback result={result} />
        <Button type="submit" loading={pending}>Registrar indicação</Button>
      </form>
    </ErpPanel>
  </>;
}

function StatusForm({ row }: { row: Row }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ReferralActionResult>(INITIAL);
  const [nextStatus, setNextStatus] = useState<string>(row.nextStatuses[0]?.value ?? "");
  const [duplicateOf, setDuplicateOf] = useState<Picked | null>(null);
  const prefix = `referral-${row.id}`;
  const reasonRequired = nextStatus === "lost" || row.status === "lost" || row.status === "duplicate";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const response = await changeReferralStatusAction(INITIAL, data);
      setResult(response);
      if (response.ok) router.refresh();
    });
  }
  return <form onSubmit={submit} className="flex flex-col gap-3">
    <input type="hidden" name="id" value={row.id} />
    <input type="hidden" name="version" value={row.version} />
    <input type="hidden" name="leadId" value={nextStatus === "duplicate" ? duplicateOf?.id ?? "" : ""} />
    <Field>
      <FieldLabel htmlFor={`${prefix}-status`}>Nova etapa</FieldLabel>
      <AppSelect id={`${prefix}-status`} name="status" value={nextStatus} disabled={pending} onValueChange={setNextStatus} options={row.nextStatuses} />
    </Field>
    {nextStatus === "duplicate" ? <Field>
      <FieldLabel>Negócio que já existe para este contato</FieldLabel>
      {duplicateOf
        ? <PickedItem item={duplicateOf} disabled={pending} onClear={() => setDuplicateOf(null)} />
        : <LeadSearchAdd placeholder="Buscar negócio por nome ou telefone" disabled={pending} onAdd={setDuplicateOf} />}
    </Field> : null}
    <Field>
      <FieldLabel htmlFor={`${prefix}-reason`}>{reasonRequired ? "Motivo" : "Motivo (opcional)"}</FieldLabel>
      <Textarea
        id={`${prefix}-reason`}
        name="reason"
        required={reasonRequired}
        minLength={reasonRequired ? 5 : undefined}
        maxLength={500}
        disabled={pending}
      />
    </Field>
    {nextStatus === "contacting" && !row.consent ? <FieldDescription>O contato só pode começar com o consentimento registrado.</FieldDescription> : null}
    {nextStatus === "converted" ? <FieldDescription>A conversão exige o negócio vinculado convertido ou com venda ativa no CRM.</FieldDescription> : null}
    <Feedback result={result} />
    <Button type="submit" variant="outline" loading={pending} disabled={nextStatus === "duplicate" && !duplicateOf}>Salvar etapa</Button>
  </form>;
}

function LinkLead({ row }: { row: Row }) {
  const router = useRouter();
  const [addingId, setAddingId] = useState<string | null>(null);
  const [result, setResult] = useState<ReferralActionResult>(INITIAL);
  const [, startTransition] = useTransition();

  function link(lead: Picked) {
    const data = new FormData();
    data.set("id", row.id);
    data.set("version", String(row.version));
    data.set("leadId", lead.id);
    setAddingId(lead.id);
    startTransition(async () => {
      const response = await linkReferralLeadAction(INITIAL, data);
      setResult(response);
      setAddingId(null);
      if (response.ok) router.refresh();
    });
  }
  return <div className="flex flex-col gap-3">
    <p className="text-sm text-muted-foreground">
      A indicação não cria negócios automaticamente. Crie o negócio em <Link href="/leads" className="underline underline-offset-2">Leads</Link> e depois vincule aqui.
    </p>
    <LeadSearchAdd placeholder="Buscar negócio por nome ou telefone" disabled={!!addingId} addingId={addingId} onAdd={link} />
    <Feedback result={result} />
  </div>;
}

function Timeline({ referralId }: { referralId: string }) {
  const [pages, setPages] = useState<ReferralTimeline[]>([]);
  const [error, setError] = useState("");
  const [loading, startLoading] = useTransition();
  const load = useCallback((page: number) => startLoading(async () => {
    const response = await getReferralTimelineAction(referralId, page);
    if (!response.ok) {
      setError(response.message);
      return;
    }
    setError("");
    setPages((current) => [...current.filter((item) => item.page < page), response.timeline]);
  }), [referralId]);
  useEffect(() => {
    load(1);
  }, [load]);
  const items = pages.flatMap((page) => page.items);
  const last = pages[pages.length - 1];
  const hasMore = !!last && last.page * last.pageSize < last.total;
  if (error) return <p className="text-sm text-destructive" role="alert">{error}</p>;
  if (!pages.length) return <p className="text-sm text-muted-foreground" role="status">Carregando histórico…</p>;
  if (!items.length) return <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>;
  return <div className="flex flex-col gap-3">
    <ol className="flex flex-col gap-3">
      {items.map((event) => <li key={event.id} className="text-sm">
        <p className="font-medium">{event.label}{event.status ? ` · ${event.status}` : ""}</p>
        <p className="text-muted-foreground">{event.actor} · {formatDateTime(event.createdAt)}</p>
        {event.reason ? <p>{event.reason}</p> : null}
      </li>)}
    </ol>
    {hasMore ? <Button type="button" size="sm" variant="ghost" loading={loading} onClick={() => load(last.page + 1)}>Ver mais antigos</Button> : null}
  </div>;
}

function leadValue(row: Row) {
  if (!row.leadId) return "Nenhum";
  if (row.canOpenLead) return <Link href={`/leads/${row.leadId}`} className="underline underline-offset-2">{row.leadName ?? "Abrir negócio"}</Link>;
  return row.leadName ?? "Negócio fora do seu acesso";
}

function ReferralPanel({ row, open, onOpenChange }: { row: Row; open: boolean; onOpenChange: (open: boolean) => void }) {
  const details = [
    { label: "Etapa", value: <Badge variant={statusVariant(row.status)}>{row.statusLabel}</Badge> },
    { label: "Telefone", value: row.referredPhone },
    { label: "Consentimento de contato", value: row.consent ? "Autorizado" : "Não registrado" },
    { label: "Responsável", value: row.ownerName ?? "Não informado" },
    ...(row.referrerContact ? [{ label: "Contato de quem indicou", value: row.referrerContact }] : []),
    { label: "Negócio vinculado", value: leadValue(row) },
    ...(row.lostReason ? [{ label: "Motivo da perda", value: row.lostReason }] : []),
    ...(row.notes ? [{ label: "Observações", value: row.notes }] : []),
  ];
  return <ErpPanel
    open={open}
    onOpenChange={onOpenChange}
    title={row.referredName}
    description={`Indicação de ${row.referrerName} · ${row.channelLabel} · ${row.statusLabel}`}
  >
    <Details items={details} />
    {row.nextStatuses.length ? <PanelSection title="Mudar etapa"><StatusForm row={row} /></PanelSection> : null}
    {row.canLink ? <PanelSection title={row.leadId ? "Trocar negócio vinculado" : "Vincular negócio"}><LinkLead row={row} /></PanelSection> : null}
    <PanelSection title="Histórico"><Timeline referralId={row.id} /></PanelSection>
  </ErpPanel>;
}

export function ReferralsWorkspace({ workspace }: { workspace: Workspace }) {
  const focusId = workspace.filters.id;
  const [selectedId, setSelectedId] = useState<string | null>(() => focusId && workspace.rows.some((row) => row.id === focusId) ? focusId : null);
  const selected = workspace.rows.find((row) => row.id === selectedId) ?? null;
  const filtered = !!workspace.filters.q || workspace.filters.status !== "all" || !!workspace.filters.id;
  const menu = (row: Row): ErpMenuItem[] => [
    { id: "open", label: "Abrir indicação", onSelect: () => setSelectedId(row.id) },
    ...(row.canOpenLead && row.leadId ? [{ id: "lead", label: "Abrir negócio", href: `/leads/${row.leadId}` }] : []),
  ];
  const columns: ErpColumn<Row>[] = [
    { id: "referred", label: "Indicado", primary: true, render: (row) => row.referredName },
    { id: "referrer", label: "Indicado por", secondary: true, render: (row) => row.referrerName },
    { id: "channel", label: "Canal", render: (row) => row.channelLabel },
    { id: "status", label: "Etapa", render: (row) => <Badge variant={statusVariant(row.status)}>{row.statusLabel}</Badge> },
    { id: "owner", label: "Responsável", nowrap: true, render: (row) => row.ownerName ?? "Não informado" },
    { id: "created", label: "Registro", nowrap: true, render: (row) => formatDate(row.createdAt) },
    {
      id: "menu",
      label: "Ações",
      render: (row) => <div onClick={(event) => event.stopPropagation()}><ErpRowMenu label={`Ações de ${row.referredName}`} items={menu(row)} /></div>,
    },
  ];
  return <>
    <ErpList
      title="Indicações"
      description="Origem, responsável e andamento de cada indicação."
      actions={<NewReferralButton workspace={workspace} />}
      columns={columns}
      rows={workspace.rows}
      rowKey={(row) => row.id}
      onRowOpen={(row) => setSelectedId(row.id)}
      emptyTitle={filtered ? "Nenhuma indicação nesta busca" : "Nenhuma indicação registrada"}
      emptyText={workspace.canManage ? "Use “Nova indicação” para registrar um contato indicado ou ajuste os filtros." : "Ajuste os filtros ou confira com a gestão."}
      footer={<ErpPager page={workspace.filters.page} total={workspace.total} pageSize={workspace.pageSize} label="Paginação de indicações" />}
    />
    {selected ? <ReferralPanel
      key={`${selected.id}-${selected.version}`}
      row={selected}
      open
      onOpenChange={(open) => { if (!open) setSelectedId(null); }}
    /> : null}
  </>;
}
