"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/arc/badge/badge";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { SearchField } from "@/components/arc/search-field/search-field";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { PeopleEmpty, PeoplePage, PeopleRow, PeopleSection } from "@/components/light/people-list/people-list";
import { AppSelect } from "@/components/ui/select";
import {
  type BrokerClientWalletFilters,
  type BrokerClientWalletResult,
  type BrokerClientWalletView,
} from "@/features/customers/broker-client-wallet";
import { serializeBrokerClientWalletFilters } from "@/features/customers/broker-client-wallet-url";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";

import styles from "./broker-client-wallet.module.css";

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

const attentionLabels = {
  overdue_return: "Retorno atrasado",
  today_return: "Retorno hoje",
  renewal: "Renovação próxima",
} as const;

const attentionTones = {
  overdue_return: "danger",
  today_return: "warning",
  renewal: "info",
} as const;

const contractLabels = {
  active: { text: "Contrato ativo", tone: "success" },
  cancelled: { text: "Contrato cancelado", tone: "neutral" },
} as const;

const originLabels: Record<string, string> = {
  manual: "Cadastro manual",
  webhook: "Integração",
};

function buildQuery(filters: BrokerClientWalletFilters, overrides: Partial<BrokerClientWalletFilters> = {}) {
  return serializeBrokerClientWalletFilters({ ...filters, ...overrides });
}

function buildHref(filters: BrokerClientWalletFilters, overrides: Partial<BrokerClientWalletFilters> = {}) {
  const query = buildQuery(filters, overrides);
  return query ? `/clientes?${query}` : "/clientes";
}

function describeAction(row: BrokerClientWalletResult["rows"][number]) {
  if (row.nextTask) {
    const due = row.nextTask.dueAt ? dateTime.format(new Date(row.nextTask.dueAt)) : "sem data";
    return [`Próxima ação: ${row.nextTask.title}`, due].join(" · ");
  }
  return "Sem próxima ação registrada";
}

function ClientWalletControls({
  filters,
  counts,
  hasRenewalData,
  origins,
}: {
  filters: BrokerClientWalletFilters;
  counts: BrokerClientWalletResult["counts"];
  hasRenewalData: boolean;
  origins: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState(filters.query ?? "");

  const segments = [
    { value: "all", label: "Todos", accessory: <span className={styles.count}>{counts.all}</span> },
    { value: "attention", label: "Precisa de atenção", accessory: <span className={styles.count}>{counts.attention}</span> },
    ...(hasRenewalData ? [{ value: "renewals", label: "Renovações", accessory: <span className={styles.count}>{counts.renewals}</span> }] : []),
  ];

  return (
    <div className={styles.controls}>
      <SegmentedControl
        className={styles.segments}
        label="Recortes da carteira"
        options={segments}
        value={filters.view}
        onValueChange={(value) => router.push(buildHref(filters, { view: value as BrokerClientWalletView, page: 1 }))}
      />
      <div className={styles.controlRow}>
        <form action="/clientes" method="get" className={styles.searchForm}>
          <input type="hidden" name="view" value={filters.view} />
          {filters.origin ? <input type="hidden" name="origin" value={filters.origin} /> : null}
          {filters.contractStatus ? <input type="hidden" name="contract" value={filters.contractStatus} /> : null}
          {filters.returnStatus ? <input type="hidden" name="return" value={filters.returnStatus} /> : null}
          <SearchField
            label="Buscar cliente"
            name="q"
            value={query}
            onValueChange={setQuery}
            placeholder="Nome ou telefone"
            clearLabel="Limpar busca"
          />
          <Button type="submit" variant="secondary" className={styles.searchButton}>Buscar</Button>
        </form>
        <BottomSheet
          className="arc-venancor"
          trigger={<Button variant="secondary" className={styles.filterButton}>Filtros</Button>}
          title="Filtrar clientes"
          description="Use dados da carteira e retornos registrados."
          closeLabel="Fechar filtros"
          detents={[0.56, 0.9]}
        >
          <form action="/clientes" method="get" className={styles.filterForm}>
            <input type="hidden" name="view" value={filters.view} />
            {query ? <input type="hidden" name="q" value={query} /> : null}
            <div className={styles.field}>
              <span>Contrato</span>
              <AppSelect
                aria-label="Situação do contrato"
                name="contract"
                defaultValue={filters.contractStatus ?? ""}
                options={[
                  { value: "", label: "Qualquer situação" },
                  { value: "active", label: "Ativo" },
                  { value: "cancelled", label: "Cancelado" },
                ]}
                triggerClassName={styles.selectTrigger}
              />
            </div>
            <div className={styles.field}>
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
                triggerClassName={styles.selectTrigger}
              />
            </div>
            <div className={styles.field}>
              <span>Origem do lead</span>
              <AppSelect
                aria-label="Origem do lead"
                name="origin"
                defaultValue={filters.origin ?? ""}
                options={[
                  { value: "", label: "Todas as origens" },
                  ...origins.map((origin) => ({ value: origin, label: originLabels[origin] ?? origin })),
                ]}
                triggerClassName={styles.selectTrigger}
              />
            </div>
            <div className={styles.sheetActions}>
              <Link className={styles.resetLink} href={buildHref(filters, { page: 1, origin: undefined, contractStatus: undefined, returnStatus: undefined })}>Limpar filtros</Link>
              <Button type="submit" variant="primary">Aplicar filtros</Button>
            </div>
          </form>
        </BottomSheet>
      </div>
    </div>
  );
}

export function BrokerClientWallet({ wallet, filters, hideTitle = true }: { wallet: BrokerClientWalletResult; filters: BrokerClientWalletFilters; hideTitle?: boolean }) {
  const effectiveFilters = { ...filters, page: wallet.page };
  const countLabel = wallet.walletCount === 1 ? "1 cliente na carteira" : `${wallet.walletCount} clientes na carteira`;
  const visibleCount = wallet.totalCount === 1 ? "1 resultado" : `${wallet.totalCount} resultados`;
  const pageLabel = wallet.totalPages > 0 ? `Página ${wallet.page} de ${wallet.totalPages}` : "Sem páginas";

  return (
    <PeoplePage title="Clientes" hideTitle={hideTitle} subtitle={`${countLabel} · ${visibleCount}`} className={styles.page}>
      <ClientWalletControls key={buildQuery(effectiveFilters)} filters={effectiveFilters} counts={wallet.counts} hasRenewalData={wallet.hasRenewalData} origins={wallet.origins} />

      {wallet.rows.length ? (
        <PeopleSection title="Sua carteira" id="broker-wallet-list" count={wallet.totalCount} label="Clientes do corretor">
          {wallet.rows.map((client, index) => {
            const status = client.contractStatus ? contractLabels[client.contractStatus] : null;
            const whatsappUrl = buildWhatsAppUrl(client.phone);
            const href = `/clientes/${encodeURIComponent(client.id)}`;
            const chips = [
              status ? <Badge key="contract" tone={status.tone} size="sm">{status.text}</Badge> : null,
              client.attentionReason ? <Badge key="attention" tone={attentionTones[client.attentionReason]} size="sm">{attentionLabels[client.attentionReason]}</Badge> : null,
            ].filter(Boolean);
            return (
              <PeopleRow
                key={client.id}
                index={index}
                href={href}
                name={client.name}
                chip={chips.length ? <span className={styles.badges}>{chips}</span> : undefined}
                preview={describeAction(client)}
                meta={shortDate.format(new Date(client.convertedAt))}
                action={whatsappUrl ? <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={styles.whatsapp} aria-label={`WhatsApp de ${client.name}`}>WhatsApp</a> : undefined}
              />
            );
          })}
        </PeopleSection>
      ) : wallet.walletCount === 0 ? (
        <PeopleEmpty title="Sua carteira ainda está vazia" description="Clientes aparecem aqui quando uma venda gera o cadastro no CRM." />
      ) : (
        <PeopleEmpty
          title={filters.query ? "Nenhum cliente encontrado" : "Nenhum cliente neste recorte"}
          description={filters.query ? "Tente outro nome ou telefone, ou limpe a busca." : "Ajuste os filtros para ver outros clientes da sua carteira."}
          action={filters.query || filters.contractStatus || filters.returnStatus || filters.origin
            ? <Link href="/clientes" className={styles.resetButton}>Limpar busca e filtros</Link>
            : undefined}
        />
      )}

      {wallet.totalPages > 1 ? (
        <nav className={styles.pagination} aria-label="Paginação da carteira">
          {wallet.page > 1 ? <Link href={buildHref(effectiveFilters, { page: wallet.page - 1 })} rel="prev">Anterior</Link> : <span aria-disabled="true">Anterior</span>}
          <span aria-live="polite">{pageLabel}</span>
          {wallet.page < wallet.totalPages ? <Link href={buildHref(effectiveFilters, { page: wallet.page + 1 })} rel="next">Próxima</Link> : <span aria-disabled="true">Próxima</span>}
        </nav>
      ) : wallet.totalCount > 0 ? <p className={styles.pageLabel}>{pageLabel}</p> : null}
    </PeoplePage>
  );
}
