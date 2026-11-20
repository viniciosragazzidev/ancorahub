"use client";

/**
 * /clientes no visual Lite do diretor: os mesmos quatro números (com a mesma tendência), a mesma busca local, unidade
 * e período na barra (mesmos ?branch= e ?period=), a lista Lite (tabela no desktop, cartões no celular) com 10 por
 * página e o mesmo atalho para o perfil do cliente (nome em link e a linha inteira, sem coluna de ação que vira
 * ruído no cartão do celular). Os dados chegam do servidor já no escopo de quem vê.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, Copy, MessageCircle, Search } from "lucide-react";

import { StatCard } from "@/components/dashboard/metric-card";
import { LiteUrlSelect } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { formatLiteDate } from "@/components/lite/format/date";
import { toast } from "@/components/ui/sonner";
import page from "@/components/lite/page/lite-page.module.css";
import styles from "./clientes-lite.module.css";
import { DEFAULT_PERIOD, PERIOD_OPTIONS, type PeriodValue } from "@/shared/period";

import { clientConversionTrend, type ClientsMetrics } from "./clientes-list";

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

const PAGE_SIZE = 10;

/** Link do WhatsApp com o número só em dígitos; sem DDI, assume Brasil (55). Vazio sem número. */
export function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

/** Atalhos de quem atende a carteira o dia todo (20/11): abrir o WhatsApp e copiar o telefone sem sair da lista. */
function ContactShortcuts({ client }: { client: ClientLiteRow }) {
  const href = whatsappHref(client.phone);
  if (!href) return null;
  return (
    <span className={styles.shortcuts} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <a href={href} target="_blank" rel="noreferrer" className={page.iconButton} aria-label={`Abrir WhatsApp de ${client.name}`} title="Abrir no WhatsApp">
        <MessageCircle aria-hidden="true" size={16} />
      </a>
      <button type="button" className={page.iconButton} aria-label={`Copiar telefone de ${client.name}`} title="Copiar telefone"
        onClick={() => { void navigator.clipboard?.writeText(client.phone.replace(/\D/g, "")).then(() => toast.success("Telefone copiado")); }}>
        <Copy aria-hidden="true" size={16} />
      </button>
    </span>
  );
}

export function ClientesLite({ clients, metrics, period, branches, branchId }: {
  clients: ClientLiteRow[];
  metrics: ClientsMetrics;
  period: PeriodValue;
  /** Unidades para o filtro (vazio esconde o seletor, como o BranchSelect com 1 unidade ou menos). */
  branches: { id: string; name: string }[];
  branchId?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "renewal">("all");
  const renewalCount = useMemo(() => clients.filter((client) => renewsSoon(client)).length, [clients]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    // Renovação: a mais próxima primeiro, para o corretor ligar antes de vencer (20/11).
    const base = tab === "renewal"
      ? clients.filter((client) => renewsSoon(client)).sort((a, b) => (a.renewalOn ?? "").localeCompare(b.renewalOn ?? ""))
      : clients;
    if (!needle) return base;
    return base.filter((client) => [client.name, client.phone, client.email ?? "", client.brokerName ?? "", client.branchName ?? ""]
      .some((value) => value.toLocaleLowerCase("pt-BR").includes(needle)));
  }, [clients, query, tab]);
  const { pageRows, pagination, reset } = useLitePages(filtered, PAGE_SIZE);

  const trend = useMemo(() => clientConversionTrend(clients, period), [clients, period]);
  // A taxa chega como texto: "8.4" com leads, "0,0" sem leads. Number("0,0") daria NaN no gráfico.
  const conversionRate = parseFloat(metrics.conversionRate.replace(",", ".")) || 0;

  const columns = useMemo<LiteColumn<ClientLiteRow>[]>(() => [
    {
      id: "client",
      label: "Cliente",
      primary: true,
      render: (client) => (
        <span className={styles.title}>
          <Link href={`/clientes/${client.id}`} className={`${page.cellLink} ${page.cellTitle}`}>{client.name}</Link>
          {/* Selo do cartão do celular, como na versão completa; na tabela todos já são clientes ativos. */}
          <span className={`${page.badge} ${styles.phoneOnly}`} data-tone="success">Ativo</span>
        </span>
      ),
    },
    {
      id: "contact",
      label: "Contato",
      secondary: true,
      render: (client) => (
        <span className={styles.contact}>
          <span>
            <span className={page.numeric}>{client.phone}</span>
            {client.email ? <span className={page.cellSub}>{client.email}</span> : null}
          </span>
          <ContactShortcuts client={client} />
        </span>
      ),
    },
    { id: "broker", label: "Responsável", nowrap: true, render: (client) => client.brokerName ? <span title={client.brokerName}>{client.brokerName}</span> : <span className={page.muted}>Sem responsável</span> },
    { id: "branch", label: "Unidade", nowrap: true, render: (client) => client.branchName ? <span title={client.branchName}>{client.branchName}</span> : <span className={page.muted}>Geral da empresa</span> },
    { id: "converted", label: "Conversão", render: (client) => <span className={page.numeric}>{formatLiteDate(client.convertedAt)}</span> },
    {
      id: "renewal",
      label: "Renovação",
      phonePriority: "low",
      render: (client) => {
        const days = daysUntilRenewal(client.renewalOn);
        if (days === null || days < 0) return <span className={page.muted}>—</span>;
        const label = days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`;
        return days <= RENEWAL_WINDOW_DAYS
          ? <span className={page.badge} data-tone="warning" title={client.renewalOn ?? undefined}>{label}</span>
          : <span className={page.numeric} title={client.renewalOn ?? undefined}>{formatLiteDate(`${client.renewalOn}T12:00:00`)}</span>;
      },
    },
  ], []);

  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <div className={page.stats}>
        <StatCard label="Total de clientes" value={metrics.totalClients} sublabel={`${metrics.recentConversions} nos últimos ${period} dias`} sparklineData={trend} sparklineColor="var(--chart-1)" animated />
        <StatCard label="Taxa de conversão" value={`${metrics.conversionRate.replace(".", ",")}%`} sublabel="Clientes por lead" sparklineData={trend.map((value) => Math.round(value * conversionRate))} sparklineColor="var(--chart-3)" animated animationDelay={0.06} />
        <StatCard label="Média por corretor" value={metrics.avgClientsPerBroker} sublabel={`${metrics.totalBrokers} responsável(is)`} sparklineData={trend.map((value) => Math.max(0, value / Math.max(1, metrics.totalBrokers)))} sparklineColor="var(--chart-4)" animated animationDelay={0.12} />
        <StatCard label="Renovações próximas" value={metrics.upcomingRenewals} sublabel="Próximos 30 dias" sparklineData={trend.map((value) => Math.max(0, metrics.upcomingRenewals ? value + 1 : value))} sparklineColor="var(--chart-2)" animated animationDelay={0.18} />
      </div>

      <div className={page.group}>
        <div className={page.toolbar}>
          <label className={page.search}>
            <Search aria-hidden="true" size={18} className={page.searchIcon} />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                reset();
              }}
              placeholder="Buscar nome, contato ou responsável"
              aria-label="Buscar cliente"
              className={page.searchInput}
            />
          </label>
          {branches.length > 1 ? (
            <LiteUrlSelect className={page.select} label="Unidade" param="branch" value={branchId ?? ""} resetPage options={[{ value: "", label: "Todas as unidades" }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]} />
          ) : null}
          <LiteUrlSelect className={page.selectNarrow} label="Período" param="period" value={String(period)} defaultValue={String(DEFAULT_PERIOD)} method="replace" options={PERIOD_OPTIONS.map((days) => ({ value: String(days), label: `${days} dias` }))} />
        </div>

        {clients.length === 0 ? (
          <div className={page.empty}>
            <h2 className={page.emptyTitle}>Nenhum cliente convertido ainda</h2>
            <p className={page.emptyText}>Aqui fica o histórico de todos os clientes convertidos. Para adicionar um, feche um lead como vendido.</p>
            <Link href="/leads" className={page.primaryButton}>Ir para leads <ArrowRight aria-hidden="true" size={16} /></Link>
          </div>
        ) : (
          <>
            <nav className={page.countTabs} aria-label="Filtrar clientes">
              {([
                { value: "all", label: "Todos", count: clients.length },
                { value: "renewal", label: "Renovam em 30 dias", count: renewalCount },
              ] as const).map((item) => (
                <button key={item.value} type="button" className={page.countTab} data-active={tab === item.value ? "true" : undefined} aria-pressed={tab === item.value} onClick={() => { setTab(item.value); reset(); }}>
                  {item.label}<span className={page.countPill}>{item.count}</span>
                </button>
              ))}
            </nav>
            {query.trim() ? (
              <p className={page.resultLine} role="status">
                {filtered.length} {filtered.length === 1 ? "cliente" : "clientes"} para “{query.trim()}” · <button type="button" onClick={() => { setQuery(""); reset(); }}>Limpar busca</button>
              </p>
            ) : null}
            <LiteResponsiveData
              caption="Carteira de clientes ativos"
              columns={columns}
              rows={pageRows}
              rowKey={(client) => client.id}
              onRowOpen={(client) => router.push(`/clientes/${client.id}`)}
              empty={(
                <div>
                  <p className={page.emptyTitle}>Nenhum cliente encontrado</p>
                  <p className={page.emptyText}>Ajuste a busca para ver outros resultados.</p>
                </div>
              )}
            />
            <LitePagination {...pagination} label="Páginas de clientes" itemNoun="clientes" />
          </>
        )}
      </div>
    </div>
  );
}
