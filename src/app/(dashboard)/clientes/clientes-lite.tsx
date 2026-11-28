"use client";

/**
 * /clientes no Lite (28/11/2026, artifact "Comercial", direção limpa): os quatro números numa faixa só, a busca local,
 * unidade e período na barra (mesmos ?branch= e ?period=), as abas Todos / Renovam em 30 dias, a tabela com os
 * atalhos de WhatsApp e copiar telefone e a gaveta do cliente no clique da linha, com o atalho para o perfil.
 * Os dados chegam do servidor já no escopo de quem vê.
 */
import Link from "next/link";
import { useMemo, useState } from "react";

import { LiteUrlSelect } from "@/components/lite/controls";
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { ComercialPage, FilterTabs, ListFoot, SearchField, StatStrip, cm } from "@/features/comercial-lite/comercial-kit";
import { PlSheet } from "@/app/(dashboard)/leads/distribuicao/plantao/_components/plantoes-1a1-kit";
import { cn } from "@/lib/utils";
import { DEFAULT_PERIOD, PERIOD_OPTIONS, type PeriodValue } from "@/shared/period";

import type { ClientsMetrics } from "./clientes-list";

export type ClientLiteRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  convertedAt: string;
  brokerName: string | null;
  branchName: string | null;
  /** Próxima renovação do contrato ativo ("AAAA-MM-DD"), quando há. */
  renewalOn?: string | null;
};

const RENEWAL_WINDOW_DAYS = 30;
const PAGE_SIZE = 10;
const COLUMNS = "minmax(200px, 1.4fr) minmax(190px, 1.1fr) minmax(140px, 1fr) minmax(120px, .9fr) 110px 120px";

/** Dias até a renovação (0 = hoje); null sem data. Conta em dias de calendário, sem fuso. */
export function daysUntilRenewal(renewalOn: string | null | undefined, today: Date = new Date()) {
  if (!renewalOn) return null;
  const [year, month, day] = renewalOn.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - base) / 86_400_000);
}

export function renewsSoon(client: Pick<ClientLiteRow, "renewalOn">, today?: Date) {
  const days = daysUntilRenewal(client.renewalOn, today);
  return days !== null && days >= 0 && days <= RENEWAL_WINDOW_DAYS;
}

/** Link do WhatsApp com o número só em dígitos; sem DDI, assume Brasil (55). Vazio sem número. */
export function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

function copyPhone(phone: string) {
  void navigator.clipboard?.writeText(phone.replace(/\D/g, "")).then(() => toast.success("Telefone copiado"));
}

/** Atalhos de quem atende a carteira o dia todo: abrir o WhatsApp e copiar o telefone sem sair da lista. */
function ContactShortcuts({ client }: { client: ClientLiteRow }) {
  const href = whatsappHref(client.phone);
  if (!href) return null;
  return (
    <span className={cm.shortcuts} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <a href={href} target="_blank" rel="noreferrer" className={cm.icon} aria-label={`Abrir WhatsApp de ${client.name}`} title="Abrir no WhatsApp">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 1-13.2 7.9L3 21l1.1-4.6A9 9 0 1 1 21 12Z" /></svg>
      </a>
      <button type="button" className={cm.icon} aria-label={`Copiar telefone de ${client.name}`} title="Copiar telefone" onClick={() => copyPhone(client.phone)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
      </button>
    </span>
  );
}

function RenewalCell({ client }: { client: ClientLiteRow }) {
  const days = daysUntilRenewal(client.renewalOn);
  if (days === null || days < 0) return <span className={cm.muted}>-</span>;
  const label = days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`;
  return days <= RENEWAL_WINDOW_DAYS
    ? <span className={cn(cm.badge, cm.bWarn)} title={client.renewalOn ?? undefined}>{label}</span>
    : <span className={cn(cm.num, cm.muted)} title={client.renewalOn ?? undefined}>{formatLiteDate(`${client.renewalOn}T12:00:00`)}</span>;
}

export function ClientesLite({ clients, metrics, period, branches, branchId }: {
  clients: ClientLiteRow[];
  metrics: ClientsMetrics;
  period: PeriodValue;
  /** Unidades para o filtro (vazio esconde o seletor). */
  branches: { id: string; name: string }[];
  branchId?: string;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "renewal">("all");
  const [pageNumber, setPageNumber] = useState(1);
  const [openClient, setOpenClient] = useState<ClientLiteRow | null>(null);
  const renewalCount = useMemo(() => clients.filter((client) => renewsSoon(client)).length, [clients]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    // Renovação: a mais próxima primeiro, para ligar antes de vencer.
    const base = tab === "renewal"
      ? clients.filter((client) => renewsSoon(client)).sort((a, b) => (a.renewalOn ?? "").localeCompare(b.renewalOn ?? ""))
      : clients;
    if (!needle) return base;
    return base.filter((client) => [client.name, client.phone, client.email ?? "", client.brokerName ?? "", client.branchName ?? ""]
      .some((value) => value.toLocaleLowerCase("pt-BR").includes(needle)));
  }, [clients, query, tab]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(pageNumber, totalPages);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const changeQuery = (value: string) => { setQuery(value); setPageNumber(1); };
  const summary = `${metrics.totalClients.toLocaleString("pt-BR")} ${metrics.totalClients === 1 ? "cliente" : "clientes"} · ${metrics.upcomingRenewals} ${metrics.upcomingRenewals === 1 ? "renova" : "renovam"} em 30 dias`;

  return (
    <ComercialPage title="Clientes" summary={summary}>
      <StatStrip items={[
        { label: "Clientes", value: metrics.totalClients.toLocaleString("pt-BR"), detail: `${metrics.recentConversions} nos últimos ${period} dias` },
        { label: "Conversão", value: `${metrics.conversionRate.replace(".", ",")}%`, detail: "clientes por lead" },
        { label: "Por corretor", value: metrics.avgClientsPerBroker, detail: `${metrics.totalBrokers} ${metrics.totalBrokers === 1 ? "responsável" : "responsáveis"}` },
        { label: "Renovações", value: metrics.upcomingRenewals, detail: "próximos 30 dias" },
      ]} />

      <section className={cm.card} aria-label="Carteira de clientes">
        <div className={cm.bar}>
          <SearchField value={query} onChange={changeQuery} placeholder="Buscar nome, contato ou responsável" label="Buscar cliente" />
          {branches.length > 1 ? (
            <LiteUrlSelect className={page.select} label="Unidade" param="branch" value={branchId ?? ""} resetPage options={[{ value: "", label: "Todas as unidades" }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]} />
          ) : null}
          <LiteUrlSelect className={page.selectNarrow} label="Período" param="period" value={String(period)} defaultValue={String(DEFAULT_PERIOD)} method="replace" options={PERIOD_OPTIONS.map((days) => ({ value: String(days), label: `${days} dias` }))} />
        </div>

        {clients.length === 0 ? (
          <div className={cm.empty}>
            <p className={cm.emptyTitle}>Nenhum cliente convertido ainda</p>
            <p className={cm.emptyText}>Aqui fica a carteira de clientes. Para adicionar um, feche um lead como vendido.</p>
            <Link href="/leads" className={cn(cm.pill, cm.primary)}>Ir para leads</Link>
          </div>
        ) : (
          <>
            <FilterTabs<"all" | "renewal"> label="Filtrar clientes" value={tab} onChange={(value) => { setTab(value); setPageNumber(1); }} items={[
              { value: "all", label: "Todos", count: clients.length },
              { value: "renewal", label: "Renovam em 30 dias", count: renewalCount },
            ]} />
            {query.trim() ? (
              <p className={cm.resultLine} role="status">
                {filtered.length} {filtered.length === 1 ? "cliente" : "clientes"} para “{query.trim()}” · <button type="button" onClick={() => changeQuery("")}>Limpar busca</button>
              </p>
            ) : null}

            <div className={cm.desktopOnly} style={{ overflowX: "auto" }}>
              <div className={cm.tableMin} role="table" aria-label="Carteira de clientes ativos">
                <div className={cn(cm.row, cm.th)} role="row" style={{ gridTemplateColumns: COLUMNS }}>
                  <span role="columnheader">Cliente</span><span role="columnheader">Contato</span><span role="columnheader">Responsável</span>
                  <span role="columnheader">Unidade</span><span role="columnheader">Conversão</span><span role="columnheader">Renovação</span>
                </div>
                {pageRows.length ? pageRows.map((client) => (
                  <div key={client.id} className={cm.row} role="row" tabIndex={0} style={{ gridTemplateColumns: COLUMNS }}
                    onClick={() => setOpenClient(client)} onKeyDown={(event) => { if (event.key === "Enter") setOpenClient(client); }}>
                    <span role="cell" className={cm.t1}>{client.name}</span>
                    <span role="cell" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ minWidth: 0, flex: 1 }}><span className={cn(cm.cell, cm.num)} style={{ display: "block" }}>{client.phone}</span>{client.email ? <span className={cm.sub}>{client.email}</span> : null}</span>
                      <ContactShortcuts client={client} />
                    </span>
                    <span role="cell" className={cn(cm.cell, !client.brokerName && cm.muted)}>{client.brokerName ?? "Sem responsável"}</span>
                    <span role="cell" className={cn(cm.cell, cm.muted)}>{client.branchName ?? "Geral da empresa"}</span>
                    <span role="cell" className={cn(cm.num, cm.muted)}>{formatLiteDate(client.convertedAt)}</span>
                    <span role="cell"><RenewalCell client={client} /></span>
                  </div>
                )) : (
                  <div className={cm.empty}><p className={cm.emptyTitle}>Nenhum cliente encontrado</p><p className={cm.emptyText}>Ajuste a busca para ver outros resultados.</p></div>
                )}
              </div>
            </div>

            <div className={cm.mobileOnly}>
              {pageRows.map((client) => (
                <div key={client.id} className={cm.mRow} role="button" tabIndex={0} onClick={() => setOpenClient(client)} onKeyDown={(event) => { if (event.key === "Enter") setOpenClient(client); }}>
                  <span className={cm.mBody}><span className={cm.t1}>{client.name}</span><span className={cn(cm.sub, cm.num)}>{client.phone}</span></span>
                  <span className={cm.mEnd}><RenewalCell client={client} /></span>
                </div>
              ))}
            </div>

            <ListFoot page={current} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} noun="clientes" onPage={setPageNumber} label="Páginas de clientes" />
          </>
        )}
      </section>

      <PlSheet
        open={Boolean(openClient)}
        onOpenChange={(open) => { if (!open) setOpenClient(null); }}
        title={openClient?.name ?? "Cliente"}
        description={openClient ? `Cliente desde ${formatLiteDate(openClient.convertedAt)}` : undefined}
        footer={openClient ? <Link href={`/clientes/${openClient.id}`} className={cn(cm.pill, cm.primary)} style={{ flex: 1 }}>Abrir perfil do cliente</Link> : null}
      >
        {openClient ? (
          <>
            <dl className={cn(cm.dl, cm.num)}>
              <dt>Telefone</dt><dd>{openClient.phone}</dd>
              <dt>E-mail</dt><dd>{openClient.email ?? "Não informado"}</dd>
              <dt>Responsável</dt><dd>{openClient.brokerName ?? "Sem responsável"}</dd>
              <dt>Unidade</dt><dd>{openClient.branchName ?? "Geral da empresa"}</dd>
              <dt>Renovação</dt><dd><RenewalCell client={openClient} /></dd>
            </dl>
            {whatsappHref(openClient.phone) ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href={whatsappHref(openClient.phone)!} target="_blank" rel="noreferrer" className={cn(cm.pill, cm.quiet)}>Abrir no WhatsApp</a>
                <button type="button" className={cn(cm.pill, cm.quiet)} onClick={() => copyPhone(openClient.phone)}>Copiar telefone</button>
              </div>
            ) : null}
          </>
        ) : null}
      </PlSheet>
    </ComercialPage>
  );
}
