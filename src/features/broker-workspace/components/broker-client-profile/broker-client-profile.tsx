"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { Avatar } from "@/components/arc/avatar/avatar";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { motionTokens } from "@/components/arc/motion-tokens";
import { LitePageEnter } from "@/components/light/light-motion";
import type { BrokerClientProfileData, ProfileTab, TimelineFilter } from "@/features/broker-workspace/client-profile/profile-core";

import { ProfileQuickActions } from "./profile-quick-actions";
import { ProfileTimeline } from "./profile-timeline";

import styles from "./broker-client-profile.module.css";

const TAB_LABELS: Record<ProfileTab, string> = { historico: "Histórico", sobre: "Sobre", contratos: "Contratos", documentos: "Documentos" };

const renewalLabels: Record<string, string> = {
  pending_window: "Acompanhar no prazo",
  in_renewal: "Renovação em andamento",
  renewed: "Renovado",
  churned: "Não renovado",
};

const relationshipLabels: Record<string, string> = { titular: "Titular", conjuge: "Cônjuge", filho: "Filho ou filha", outro: "Dependente" };

const dayFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function formatDay(value: string | Date | null | undefined) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return dayFormat.format(new Date(`${value}T12:00:00-03:00`));
  return dayFormat.format(new Date(value));
}

function money(value: string | null) {
  const number = Number(value ?? NaN);
  return Number.isFinite(number) ? number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Valor não informado";
}

/** Atualiza `?aba=` e `?filtro=` sem navegar, para a visão voltar igual ao recarregar ou compartilhar o link. */
function syncUrl(key: "aba" | "filtro", value: string, fallback: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (value === fallback) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  window.history.replaceState(window.history.state, "", url);
}

function SummaryCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.summaryCard}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function ProfileSummaryPanel({ data }: { data: BrokerClientProfileData }) {
  const { summary, history } = data;
  const next = summary.nextAction;
  return (
    <section className={styles.summary} aria-labelledby="profile-summary-title">
      <h2 id="profile-summary-title" className={styles.srOnly}>Resumo do cliente</h2>
      <SummaryCard title="Última interação">
        {history.status !== "ok" ? (
          <p className={styles.muted}>Histórico indisponível agora.</p>
        ) : summary.lastInteraction ? (
          <p>
            <strong>{summary.lastInteraction.label}</strong>
            <span className={styles.muted}> {[summary.lastInteraction.author, dateTimeFormat.format(new Date(summary.lastInteraction.at))].filter(Boolean).join(" · ")}</span>
          </p>
        ) : (
          <p className={styles.muted}>Nenhum atendimento registrado.</p>
        )}
      </SummaryCard>
      <SummaryCard title="Próxima ação">
        {next === null ? (
          <p className={styles.muted} role="alert">Não foi possível carregar o retorno agora. Recarregue a página para tentar de novo.</p>
        ) : next.state === "none" || next.state === "not_owner" ? (
          <p className={styles.muted}>{next.reason}</p>
        ) : (
          <p>
            <strong data-state={next.state} className={next.state === "overdue" ? styles.overdue : undefined}>{next.title ?? "Retorno"}</strong>
            <span className={styles.muted}> {next.reason}{next.dueAt ? ` · ${dateTimeFormat.format(new Date(next.dueAt))}` : ""}</span>
          </p>
        )}
      </SummaryCard>
      <SummaryCard title="Contratos">
        {summary.contracts.total === 0 ? (
          <p className={styles.muted}>Nenhuma venda registrada.</p>
        ) : (
          <p>
            <strong>{summary.contracts.active === 1 ? "1 venda ativa" : `${summary.contracts.active} vendas ativas`}</strong>
            <span className={styles.muted}> {summary.contracts.headline ?? `${summary.contracts.total} no total`}</span>
          </p>
        )}
      </SummaryCard>
      <SummaryCard title="Pendências">
        {summary.pendencies.length ? (
          <ul className={styles.pendencies}>
            {summary.pendencies.map((item) => <li key={item.id}>{item.label}</li>)}
          </ul>
        ) : (
          <p className={styles.muted}>Nenhuma pendência registrada.</p>
        )}
      </SummaryCard>
    </section>
  );
}

function AboutSection({ data }: { data: BrokerClientProfileData }) {
  const { client, beneficiaries } = data;
  return (
    <div className={styles.sectionStack}>
      <section className={styles.panel} aria-labelledby="profile-contact-title">
        <h2 id="profile-contact-title">Contato</h2>
        <dl className={styles.facts}>
          <div><dt>Telefone</dt><dd>{client.phone ?? "Não informado"}</dd></div>
          <div><dt>E-mail</dt><dd>{client.email ?? "Não informado"}</dd></div>
          <div><dt>Origem</dt><dd>{data.origin ?? "Não informada"}</dd></div>
          <div><dt>Corretor responsável</dt><dd>{client.brokerName ?? "Não informado"}</dd></div>
          <div><dt>Unidade</dt><dd>{client.branchName ?? "Sem unidade"}</dd></div>
          <div><dt>Cliente desde</dt><dd>{formatDay(client.convertedAt)}</dd></div>
        </dl>
      </section>
      <section className={styles.panel} aria-labelledby="profile-beneficiaries-title">
        <h2 id="profile-beneficiaries-title">Beneficiários ({beneficiaries.length})</h2>
        {beneficiaries.length ? (
          <ul className={styles.rows}>
            {beneficiaries.map((beneficiary) => (
              <li key={beneficiary.id}>
                <strong>{beneficiary.name}</strong>
                <small>{beneficiary.isHolder ? "Titular" : relationshipLabels[beneficiary.relationship ?? ""] ?? "Dependente"}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>Nenhum beneficiário cadastrado.</p>
        )}
      </section>
    </div>
  );
}

function ContractsSection({ data }: { data: BrokerClientProfileData }) {
  const { activeCustomer, sales } = data;
  const cancelled = activeCustomer?.status === "cancelled";
  return (
    <div className={styles.sectionStack}>
      <section className={styles.panel} aria-labelledby="profile-contract-title">
        <h2 id="profile-contract-title">Contrato</h2>
        {activeCustomer ? (
          <dl className={styles.facts}>
            <div><dt>Situação</dt><dd>{cancelled ? "Cancelado" : "Ativo"}</dd></div>
            <div><dt>Início da vigência</dt><dd>{formatDay(activeCustomer.coverageStartDate) ?? "Não informado"}</dd></div>
            <div><dt>Aniversário do contrato</dt><dd>{formatDay(activeCustomer.contractAnniversary) ?? "Não informado"}</dd></div>
            <div><dt>Renovação</dt><dd>{renewalLabels[activeCustomer.renewalStatus] ?? "Não informada"}</dd></div>
            {cancelled ? (
              <div><dt>Cancelamento</dt><dd>{formatDay(activeCustomer.cancellationDate) ?? "Data não informada"}{activeCustomer.cancellationReason ? `. ${activeCustomer.cancellationReason}` : ""}</dd></div>
            ) : null}
          </dl>
        ) : (
          <p className={styles.muted}>Nenhum contrato registrado para este cliente.</p>
        )}
      </section>
      <section className={styles.panel} aria-labelledby="profile-sales-title">
        <h2 id="profile-sales-title">Vendas ({sales.length})</h2>
        {sales.length ? (
          <ul className={styles.rows}>
            {sales.map((sale) => (
              <li key={sale.id}>
                <strong>{[sale.carrierName, sale.planName].filter(Boolean).join(" · ") || "Venda"}</strong>
                <small>{[money(sale.saleValue), sale.policyNumber ? `Apólice ${sale.policyNumber}` : null, formatDay(sale.saleDate), sale.status === "cancelled" ? "Cancelada" : null].filter(Boolean).join(" · ")}</small>
                {data.canAct ? <Link href={`/vendas/${encodeURIComponent(sale.id)}`} className={styles.inlineLink}>Ver venda</Link> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>Nenhuma venda registrada.</p>
        )}
      </section>
    </div>
  );
}

function DocumentsSection({ data, documentsSlot }: { data: BrokerClientProfileData; documentsSlot?: ReactNode }) {
  return (
    <section className={styles.panel} aria-labelledby="profile-documents-title">
      <h2 id="profile-documents-title">Documentos ({data.documents.length})</h2>
      {documentsSlot ? documentsSlot : data.documents.length ? (
        <ul className={styles.rows}>
          {data.documents.map((document) => (
            <li key={document.id}>
              <strong>{document.filename}</strong>
              <small>{[document.requirementName, document.status === "approved" ? "Aprovado" : document.status === "rejected" ? "Recusado" : "Aguardando revisão"].filter(Boolean).join(" · ")}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>Nenhum documento enviado.</p>
      )}
    </section>
  );
}

/**
 * Perfil do cliente do corretor (etapa 5 do plano do modo corretor). Cabeçalho com identidade, ações rápidas,
 * resumo (coluna lateral no desktop) e as abas Histórico, Sobre, Contratos e Documentos. Os dados chegam do servidor
 * já filtrados pela carteira do corretor.
 */
export function BrokerClientProfile({ data, documentsSlot, initialTab = "historico", initialFilter = "tudo" }: {
  data: BrokerClientProfileData;
  documentsSlot?: ReactNode;
  initialTab?: ProfileTab;
  initialFilter?: TimelineFilter;
}) {
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [filter, setFilter] = useState<TimelineFilter>(initialFilter);
  const reduce = useReducedMotion();
  const { client } = data;

  const tabs = (Object.keys(TAB_LABELS) as ProfileTab[]).map((value) => ({ value, label: TAB_LABELS[value] }));
  const panelMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 } };

  return (
    <LitePageEnter className={`arc-venancor ${styles.page}`}>
      <Link href="/clientes" className={styles.back}>Minha carteira</Link>

      <header className={styles.header}>
        <div className={styles.cover} aria-hidden="true" />
        <div className={styles.identity}>
          <Avatar name={client.name} src={data.avatarSrc ?? undefined} size="xl" className={styles.avatar} />
          <div className={styles.identityText}>
            <h1>{client.name}</h1>
            <ul className={styles.tags} aria-label="Situação do cliente">
              <li className={data.situation.tone === "accent" ? styles.tagAccent : styles.tag}>{data.situation.label}</li>
              {data.origin ? <li className={styles.tag}>Origem: {data.origin}</li> : null}
            </ul>
            <p className={styles.muted}>Responsável: {client.brokerName ?? "Não informado"}</p>
          </div>
        </div>
        <ProfileQuickActions client={client} canAct={data.canAct} readOnlyReason={data.readOnlyReason} />
      </header>

      <div className={styles.layout}>
        <aside className={styles.aside} aria-label="Resumo">
          <ProfileSummaryPanel data={data} />
        </aside>

        <div className={styles.main}>
          <SegmentedControl
            label="Seções do perfil"
            options={tabs}
            value={tab}
            onValueChange={(value) => {
              setTab(value as ProfileTab);
              syncUrl("aba", value, "historico");
            }}
          />
          <motion.div key={tab} className={styles.tabPanel} {...panelMotion} transition={{ duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}>
            {tab === "historico" ? (
              <section className={styles.panel} aria-labelledby="profile-history-title">
                <h2 id="profile-history-title">Histórico</h2>
                <ProfileTimeline
                  history={data.history}
                  filter={filter}
                  onFilterChange={(value) => {
                    setFilter(value);
                    syncUrl("filtro", value, "tudo");
                  }}
                />
              </section>
            ) : null}
            {tab === "sobre" ? <AboutSection data={data} /> : null}
            {tab === "contratos" ? <ContractsSection data={data} /> : null}
            {tab === "documentos" ? <DocumentsSection data={data} documentsSlot={documentsSlot} /> : null}
          </motion.div>
        </div>
      </div>
    </LitePageEnter>
  );
}
