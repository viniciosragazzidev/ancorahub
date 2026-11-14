"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/arc/badge/badge";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { SearchField } from "@/components/arc/search-field/search-field";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { PeopleEmpty, PeoplePage, PeopleRow, PeopleSection } from "@/components/light/people-list/people-list";
import { AppSelect } from "@/components/ui/select";
import { liteStageLabel } from "@/app/(dashboard)/leads/lite-stage-labels";
import type { BrokerClientWalletResult } from "@/features/customers/broker-client-wallet";
import {
  BROKER_WALLET_ARCHIVED_STAGES,
  BROKER_WALLET_NEGOTIATING_STAGES,
  brokerWalletHref,
  brokerWalletViewHref,
  hasBrokerWalletNarrowing,
  isBrokerWalletLeadView,
  type BrokerWalletFilters,
  type BrokerWalletView,
} from "@/features/customers/broker-wallet-filters";
import type { BrokerWalletLeadsResult } from "@/features/customers/broker-wallet-leads";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";
import { WhatsappLogo } from "@/components/huge-icons";

import { BrokerClientWalletList, originLabels } from "./broker-client-wallet";
import { BrokerWalletAddContact, type BrokerWalletAddContactAction } from "./broker-wallet-add-contact";
import type { PriorClientAction } from "./prior-client-form";
import walletStyles from "./broker-client-wallet.module.css";
import styles from "./broker-my-wallet.module.css";

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

export type BrokerMyWalletCounts = Record<BrokerWalletView, number>;

const VIEW_LABELS: Record<BrokerWalletView, string> = {
  negotiating: "Em negociação",
  all: "Clientes",
  attention: "Precisa de atenção",
  archived: "Arquivados",
};

const ARCHIVED_LABELS: Record<(typeof BROKER_WALLET_ARCHIVED_STAGES)[number], string> = { lost: "Perdido", archived: "Arquivado" };

const EMPTY_COPY: Record<BrokerWalletView, { title: string; description: string }> = {
  negotiating: { title: "Nenhum contato em negociação", description: "Leads que você recebe ou cadastra aparecem aqui enquanto estiverem em atendimento." },
  all: { title: "Nenhum cliente ainda", description: "Clientes aparecem aqui quando uma venda gera o cadastro no CRM." },
  attention: { title: "Nada pedindo atenção agora", description: "Retornos vencidos ou de hoje e renovações próximas aparecem aqui quando houver registro." },
  archived: { title: "Nenhum contato arquivado", description: "Leads perdidos ou arquivados ficam aqui para consulta." },
};

function leadPreview(row: BrokerWalletLeadsResult["rows"][number], view: BrokerWalletLeadsResult["view"]) {
  if (view === "archived") return row.archived ? "Arquivado" : "Perdido";
  if (!row.nextTask) return "Sem próxima ação registrada";
  return `Próxima ação: ${row.nextTask.title} · ${row.nextTask.dueAt ? dateTime.format(new Date(row.nextTask.dueAt)) : "sem data"}`;
}

function WalletFilters({ filters, origins }: { filters: BrokerWalletFilters; origins: string[] }) {
  const leadView = isBrokerWalletLeadView(filters.view);
  const stageOptions = filters.view === "negotiating"
    ? BROKER_WALLET_NEGOTIATING_STAGES.map((stage) => ({ value: stage, label: liteStageLabel(stage) }))
    : filters.view === "archived"
      ? BROKER_WALLET_ARCHIVED_STAGES.map((stage) => ({ value: stage, label: ARCHIVED_LABELS[stage] }))
      : [];
  const narrowed = Boolean(filters.origin || filters.stage || filters.contractStatus || filters.returnStatus);
  return (
    <BottomSheet
      className="arc-venancor"
      trigger={<Button variant="secondary" className={walletStyles.filterButton}>{narrowed ? "Filtros ativos" : "Filtros"}</Button>}
      title={`Filtrar ${VIEW_LABELS[filters.view].toLocaleLowerCase("pt-BR")}`}
      description="Situação e origem são filtros separados."
      closeLabel="Fechar filtros"
      detents={[0.6, 0.9]}
    >
      <form action="/clientes" method="get" className={walletStyles.filterForm}>
        <input type="hidden" name="view" value={filters.view} />
        {filters.query ? <input type="hidden" name="q" value={filters.query} /> : null}
        {leadView ? (
          <div className={walletStyles.field}>
            <span>Situação</span>
            <AppSelect
              aria-label="Situação"
              name="situacao"
              defaultValue={filters.stage ?? ""}
              options={[{ value: "", label: "Qualquer situação" }, ...stageOptions]}
              triggerClassName={walletStyles.selectTrigger}
            />
          </div>
        ) : (
          <>
            <div className={walletStyles.field}>
              <span>Situação do contrato</span>
              <AppSelect
                aria-label="Situação do contrato"
                name="contract"
                defaultValue={filters.contractStatus ?? ""}
                options={[{ value: "", label: "Qualquer situação" }, { value: "active", label: "Ativo" }, { value: "cancelled", label: "Cancelado" }]}
                triggerClassName={walletStyles.selectTrigger}
              />
            </div>
            <div className={walletStyles.field}>
              <span>Retorno</span>
              <AppSelect
                aria-label="Prazo do retorno"
                name="return"
                defaultValue={filters.returnStatus ?? ""}
                options={[
                  { value: "", label: "Qualquer prazo" },
                  { value: "overdue", label: "Atrasado" },
                  { value: "today", label: "Hoje" },
                  { value: "future", label: "Futuro" },
                  { value: "none", label: "Sem data de retorno" },
                ]}
                triggerClassName={walletStyles.selectTrigger}
              />
            </div>
          </>
        )}
        <div className={walletStyles.field}>
          <span>Origem</span>
          <AppSelect
            aria-label="Origem"
            name="origin"
            defaultValue={filters.origin ?? ""}
            options={[{ value: "", label: "Todas as origens" }, ...origins.map((origin) => ({ value: origin, label: originLabels[origin] ?? origin }))]}
            triggerClassName={walletStyles.selectTrigger}
          />
        </div>
        <div className={walletStyles.sheetActions}>
          <Link className={walletStyles.resetLink} href={brokerWalletViewHref({ ...filters, origin: undefined }, filters.view)}>Limpar filtros</Link>
          <Button type="submit" variant="primary">Aplicar filtros</Button>
        </div>
      </form>
    </BottomSheet>
  );
}

function WalletControls({ filters, counts, origins, addContact }: { filters: BrokerWalletFilters; counts: BrokerMyWalletCounts; origins: string[]; addContact?: ReactNode }) {
  const router = useRouter();
  const [query, setQuery] = useState(filters.query ?? "");
  // Em negociação não é aba da carteira: quem está em atendimento fica em Meus leads.
  const segments = (Object.keys(VIEW_LABELS) as BrokerWalletView[]).filter((view) => view !== "negotiating").map((view) => ({
    value: view,
    label: VIEW_LABELS[view],
    accessory: <span className={walletStyles.count}>{counts[view]}</span>,
  }));

  return (
    <div className={walletStyles.controls}>
      <SegmentedControl
        className={`${walletStyles.segments} ${styles.tabs}`}
        label="Visões da carteira"
        options={segments}
        value={filters.view}
        onValueChange={(value) => router.push(brokerWalletViewHref(filters, value as BrokerWalletView))}
      />
      <div className={styles.toolbar}>
        <form action="/clientes" method="get" className={styles.search} role="search">
          <input type="hidden" name="view" value={filters.view} />
          {filters.origin ? <input type="hidden" name="origin" value={filters.origin} /> : null}
          {filters.stage ? <input type="hidden" name="situacao" value={filters.stage} /> : null}
          {filters.contractStatus ? <input type="hidden" name="contract" value={filters.contractStatus} /> : null}
          {filters.returnStatus ? <input type="hidden" name="return" value={filters.returnStatus} /> : null}
          <SearchField label="Buscar na carteira" name="q" value={query} onValueChange={setQuery} placeholder="Nome ou telefone" clearLabel="Limpar busca" enterKeyHint="search" />
        </form>
        <WalletFilters filters={filters} origins={origins} />
        {addContact}
      </div>
    </div>
  );
}

function LeadRows({ leads }: { leads: BrokerWalletLeadsResult }) {
  return (
    <PeopleSection title={VIEW_LABELS[leads.view]} id="broker-wallet-leads" count={leads.totalCount} label={leads.view === "archived" ? "Contatos arquivados" : "Contatos em negociação"}>
      {leads.rows.map((lead, index) => {
        const whatsappUrl = leads.view === "negotiating" ? buildWhatsAppUrl(lead.phone) : null;
        const stage = leads.view === "archived" ? null : liteStageLabel(lead.status);
        return (
          <PeopleRow
            key={lead.id}
            index={index}
            href={`/leads/${encodeURIComponent(lead.id)}`}
            name={lead.name}
            chip={stage ? <Badge tone="neutral" size="sm">{stage}</Badge> : undefined}
            preview={leadPreview(lead, leads.view)}
            meta={shortDate.format(new Date(lead.updatedAt))}
            faded={leads.view === "archived"}
            action={whatsappUrl ? <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={styles.whatsappIcon} aria-label={`WhatsApp de ${lead.name}`} title="WhatsApp"><WhatsappLogo aria-hidden="true" /></a> : undefined}
          />
        );
      })}
    </PeopleSection>
  );
}

function Pagination({ filters, page, totalPages, totalCount }: { filters: BrokerWalletFilters; page: number; totalPages: number; totalCount: number }) {
  const pageLabel = totalPages > 0 ? `Página ${page} de ${totalPages}` : "Sem páginas";
  if (totalPages > 1) {
    return (
      <nav className={walletStyles.pagination} aria-label="Paginação da carteira">
        {page > 1 ? <Link href={brokerWalletHref(filters, { page: page - 1 })} rel="prev">Anterior</Link> : <span aria-disabled="true">Anterior</span>}
        <span aria-live="polite">{pageLabel}</span>
        {page < totalPages ? <Link href={brokerWalletHref(filters, { page: page + 1 })} rel="next">Próxima</Link> : <span aria-disabled="true">Próxima</span>}
      </nav>
    );
  }
  return totalCount > 0 ? <p className={walletStyles.pageLabel}>{pageLabel}</p> : null;
}

/**
 * Minha carteira (etapa 4a do plano do modo corretor): a base de relacionamento. Quem está em atendimento
 * fica em Meus leads (o resumo do topo leva até lá). Arquivados lista leads (abrem
 * `/leads/[id]`), Clientes e Precisa de atenção listam `clients` (abrem `/clientes/[clientId]`). Busca,
 * filtros e página ficam na URL; a lista vem paginada do servidor.
 */
export function BrokerMyWallet({
  filters,
  counts,
  origins,
  leads,
  clients,
  addContactAction,
  addPriorClientAction,
}: {
  filters: BrokerWalletFilters;
  counts: BrokerMyWalletCounts;
  origins: string[];
  leads?: BrokerWalletLeadsResult;
  clients?: BrokerClientWalletResult;
  addContactAction?: BrokerWalletAddContactAction;
  /** Cliente que já possuo (DEC-187): só com a chave e a migration 0231. */
  addPriorClientAction?: PriorClientAction;
}) {
  const leadView = isBrokerWalletLeadView(filters.view);
  const page = (leadView ? leads?.page : clients?.page) ?? 1;
  const totalPages = (leadView ? leads?.totalPages : clients?.totalPages) ?? 0;
  const totalCount = (leadView ? leads?.totalCount : clients?.totalCount) ?? 0;
  const effectiveFilters = { ...filters, page };
  const hasRows = leadView ? Boolean(leads?.rows.length) : Boolean(clients?.rows.length);
  const narrowed = hasBrokerWalletNarrowing(filters);
  const summary = (
    <>
      {counts.all === 1 ? "1 cliente" : `${counts.all} clientes`}
      {" · "}
      <Link href="/leads?tab=minha-fila" className={styles.summaryLink}>
        {counts.negotiating === 1 ? "1 em negociação" : `${counts.negotiating} em negociação`}
      </Link>
    </>
  );

  return (
    <PeoplePage
      title="Minha carteira"
      hideTitle
      subtitle={summary}
      className={`${walletStyles.page} ${styles.page}`}
    >
      <WalletControls key={brokerWalletHref(effectiveFilters)} filters={effectiveFilters} counts={counts} origins={origins} addContact={addContactAction ? <BrokerWalletAddContact action={addContactAction} priorAction={addPriorClientAction} /> : undefined} />

      <div key={filters.view} className={styles.viewBody}>
        {hasRows ? (
          leadView && leads ? <LeadRows leads={leads} /> : clients ? <BrokerClientWalletList rows={clients.rows} totalCount={clients.totalCount} title={VIEW_LABELS[filters.view]} /> : null
        ) : narrowed ? (
          <PeopleEmpty
            title={filters.query ? "Nada encontrado" : "Nada neste recorte"}
            description={filters.query ? "Tente outro nome ou telefone, ou limpe a busca." : "Ajuste os filtros para ver outros contatos da sua carteira."}
            action={<Link href={brokerWalletViewHref({ view: filters.view, page: 1 }, filters.view)} className={walletStyles.resetButton}>Limpar busca e filtros</Link>}
          />
        ) : (
          <PeopleEmpty title={EMPTY_COPY[filters.view].title} description={EMPTY_COPY[filters.view].description} />
        )}
      </div>

      <Pagination filters={effectiveFilters} page={page} totalPages={totalPages} totalCount={totalCount} />
    </PeoplePage>
  );
}
