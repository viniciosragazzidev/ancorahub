"use client";

/**
 * /clientes no visual Lite do diretor: os mesmos quatro números (com a mesma tendência), a mesma busca local, unidade
 * e período na barra (mesmos ?branch= e ?period=), a lista Lite (tabela no desktop, cartões no celular) com 10 por
 * página e o mesmo atalho para o perfil do cliente. Os dados chegam do servidor já no escopo de quem vê.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronRight, Search } from "lucide-react";

import { StatCard } from "@/components/dashboard/metric-card";
import { LiteUrlSelect } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
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
};

const PAGE_SIZE = 10;

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

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    if (!needle) return clients;
    return clients.filter((client) => [client.name, client.phone, client.email ?? "", client.brokerName ?? "", client.branchName ?? ""]
      .some((value) => value.toLocaleLowerCase("pt-BR").includes(needle)));
  }, [clients, query]);
  const { pageRows, pagination, reset } = useLitePages(filtered, PAGE_SIZE);

  const trend = useMemo(() => clientConversionTrend(clients, period), [clients, period]);

  const columns = useMemo<LiteColumn<ClientLiteRow>[]>(() => [
    {
      id: "client",
      label: "Cliente",
      primary: true,
      render: (client) => (
        <Link href={`/clientes/${client.id}`} className={`${page.cellLink} ${page.cellTitle}`}>{client.name}</Link>
      ),
    },
    {
      id: "contact",
      label: "Contato",
      secondary: true,
      render: (client) => (
        <span>
          <span className={page.numeric}>{client.phone}</span>
          {client.email ? <span className={page.cellSub}>{client.email}</span> : null}
        </span>
      ),
    },
    { id: "broker", label: "Responsável", nowrap: true, render: (client) => client.brokerName ? <span title={client.brokerName}>{client.brokerName}</span> : <span className={page.muted}>Sem responsável</span> },
    { id: "branch", label: "Unidade", nowrap: true, render: (client) => client.branchName ? <span title={client.branchName}>{client.branchName}</span> : <span className={page.muted}>Geral da empresa</span> },
    { id: "converted", label: "Conversão", render: (client) => <span className={page.numeric}>{formatLiteDate(client.convertedAt)}</span> },
    {
      id: "actions",
      label: "Ações",
      numeric: true,
      render: (client) => (
        <Link href={`/clientes/${client.id}`} className={page.iconButton} aria-label="Ver perfil" title={`Ver perfil de ${client.name}`}>
          <ChevronRight aria-hidden="true" size={18} />
        </Link>
      ),
    },
  ], []);

  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <div className={page.stats}>
        <StatCard label="Total de clientes" value={metrics.totalClients} sublabel={`${metrics.recentConversions} nos últimos ${period} dias`} sparklineData={trend} sparklineColor="var(--chart-1)" animated />
        <StatCard label="Taxa de conversão" value={`${metrics.conversionRate}%`} sublabel="Clientes por lead" sparklineData={trend.map((value) => Math.round(value * Number(metrics.conversionRate)))} sparklineColor="var(--chart-3)" animated animationDelay={0.06} />
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
            <p className={page.cardDescription}>{clients.length} cliente(s) ativo(s), da conversão mais recente para a mais antiga.</p>
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
            <LitePagination {...pagination} label="Páginas de clientes" />
          </>
        )}
      </div>
    </div>
  );
}
