/**
 * Ficha do cliente no visual Lite do diretor (chave ligada e /clientes/[clientId] fora do opt-out). Mesmos dados e as
 * mesmas ações da ficha de hoje: identidade, próxima ação pós-venda, vendas, documentos com checklist e envio
 * (LeadDocumentsSection), linha do tempo com notas (LeadTimeline), dados organizados, resumo financeiro e vigência
 * com o andamento da renovação. Documentos e linha do tempo chegam prontos da página como `slots`. O nome do cliente
 * fica no topo da moldura e no cabeçalho da ficha (h2), sem h1 repetido.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Building2, Mail, MessageCircle, Phone, UserRound } from "lucide-react";

import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ClientRenewalLite } from "./client-renewal-lite";
import styles from "./client-detail-lite.module.css";

const LONG_DATE: Intl.DateTimeFormatOptions = { dateStyle: "long" };
const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** Datas sem hora ("2026-09-01"): meio-dia UTC cai no mesmo dia em São Paulo. */
const dateOnly = (value: string) => formatLiteDate(`${value}T12:00:00.000Z`);

type RenewalStatus = "pending_window" | "in_renewal" | "renewed" | "churned";

export type ClientDetailLiteProps = {
  client: {
    id: string;
    leadId: string;
    name: string;
    phone: string;
    email: string | null;
    convertedAt: Date;
    createdAt: Date;
    branchName: string | null;
    brokerName: string | null;
  };
  consentimentoLgpd: boolean;
  sales: {
    id: string;
    saleValue: string;
    policyNumber: string | null;
    saleDate: Date;
    status: string;
    notes: string | null;
    planName: string | null;
    carrierName: string | null;
  }[];
  activeCustomer: {
    id: string;
    status: string;
    coverageStartDate: string;
    contractAnniversary: string;
    renewalStatus: RenewalStatus;
    renewalNotes: string | null;
    cancellationDate: string | null;
    cancellationReason: string | null;
  } | null;
  /** Dias até a renovação (calculados na página, como hoje) e se ela está nos próximos 45 dias. */
  renewal: { days: number | null; upcoming: boolean };
  dependents: { id: string; name: string; relationship: string; isHolder: boolean }[];
  documentCount: number;
  canAccessConversas: boolean;
  hideRegistrationDate: boolean;
  slots: { documents: ReactNode; timeline: ReactNode };
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function ClientDetailLite({ client, consentimentoLgpd, sales, activeCustomer, renewal, dependents, documentCount, canAccessConversas, hideRegistrationDate, slots }: ClientDetailLiteProps) {
  const totalSalesValue = sales.reduce((sum, sale) => sum + parseFloat(sale.saleValue || "0"), 0);
  const cancelled = activeCustomer?.status === "cancelled";
  const days = renewal.days;

  return (
    <div className={`arc-venancor ${styles.root}`} data-skin="diretor">
      <section className={styles.identity} aria-labelledby="cliente-nome">
        <div className={styles.identityMain}>
          <div className={styles.nameRow}>
            <h2 id="cliente-nome" className={styles.name}>{client.name}</h2>
            <span className={page.badge} data-tone={cancelled ? "danger" : "success"}>{cancelled ? "Cliente cancelado" : "Cliente ativo"}</span>
            {renewal.upcoming ? <span className={page.badge} data-tone="warning">Renovação em {days} dias</span> : null}
          </div>
          <p className={styles.metaLine}>
            <span>Convertido em {formatLiteDate(client.convertedAt, LONG_DATE)}</span>
            {client.branchName ? <span>Unidade {client.branchName}</span> : null}
          </p>
          <ul className={styles.contact} aria-label="Contato">
            <li><Phone aria-hidden="true" size={16} /><a className={styles.link} href={`tel:${client.phone.replace(/\D/g, "")}`}>{client.phone}</a></li>
            <li><Mail aria-hidden="true" size={16} />{client.email ? <a className={styles.link} href={`mailto:${client.email}`}>{client.email}</a> : <span>E-mail não informado</span>}</li>
            <li><UserRound aria-hidden="true" size={16} /><span>{client.brokerName ?? "Responsável não informado"}</span></li>
          </ul>
        </div>
        <div className={styles.actions}>
          <Link className={page.button} href={`/leads/${client.leadId}`}><ArrowRight aria-hidden="true" size={16} />Ver lead original</Link>
        </div>
      </section>

      <section className={styles.nextAction} aria-labelledby="cliente-proxima-acao">
        <div className={styles.nextText}>
          <h3 id="cliente-proxima-acao" className={page.cardTitle}>
            {renewal.upcoming ? `Iniciar renovação de apólice (faltam ${days} dias)` : "Cliente ativo com suporte pós-venda em dia"}
          </h3>
          <p className={page.cardDescription}>
            {renewal.upcoming
              ? "Envie uma proposta de renovação antecipada para garantir retenção de carteira."
              : "Acompanhe as apólices, tarefas de relacionamento e histórico comercial deste cliente."}
          </p>
        </div>
        {canAccessConversas ? (
          <Link className={page.primaryButton} href={`/conversas?leadId=${client.leadId}`}>
            <MessageCircle aria-hidden="true" size={16} />Enviar mensagem pós-venda
          </Link>
        ) : null}
      </section>

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <Tabs defaultValue="sales" variant="segment" className={styles.tabs}>
            <div className={styles.tabList}>
              <TabsList aria-label="Seções do cliente" className="w-max">
                <TabsTrigger value="sales">Vendas<span className={styles.tabCount}>{sales.length}</span></TabsTrigger>
                <TabsTrigger value="documents">Documentos</TabsTrigger>
                <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="sales" className={styles.tabPanel}>
              <section className={page.card} aria-labelledby="cliente-vendas">
                <header className={page.cardHead}>
                  <h3 id="cliente-vendas" className={page.cardTitle}>Vendas</h3>
                  <p className={page.cardDescription}>Vendas registradas para este cliente, da mais recente para a mais antiga.</p>
                </header>
                {sales.length ? (
                  <ul className={styles.rows}>
                    {sales.map((sale) => (
                      <li key={sale.id} className={styles.row}>
                        <div className={styles.rowHead}>
                          <div className={styles.rowText}>
                            <p className={styles.rowTitle}>{sale.planName ?? "Venda"}</p>
                            <p className={styles.rowMeta}>Registrada em {formatLiteDate(sale.saleDate, LONG_DATE)}</p>
                          </div>
                          <span className={page.badge} data-tone={sale.status === "active" ? "success" : "danger"}>{sale.status === "active" ? "Ativa" : "Cancelada"}</span>
                        </div>
                        <dl className={styles.fields}>
                          <Field label="Valor"><span className={page.numeric}>{currency(parseFloat(sale.saleValue))}</span></Field>
                          {sale.policyNumber ? <Field label="Apólice">{sale.policyNumber}</Field> : null}
                          {sale.carrierName ? <Field label="Operadora">{sale.carrierName}</Field> : null}
                          
                        </dl>
                        {sale.notes ? <p className={styles.note}>{sale.notes}</p> : null}
                        <div>
                          <Link className={page.button} href={`/vendas/${sale.id}`}>Ver detalhes<ArrowRight aria-hidden="true" size={16} /></Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className={page.empty}>
                    <p className={page.emptyTitle}>Nenhuma venda registrada</p>
                    <p className={page.emptyText}>As vendas deste cliente aparecerão aqui.</p>
                  </div>
                )}
              </section>
            </TabsContent>

            <TabsContent value="documents" className={styles.tabPanel}>
              <section className={page.card} aria-labelledby="cliente-documentos">
                <header className={page.cardHead}>
                  <h3 id="cliente-documentos" className={page.cardTitle}>Documentos</h3>
                  <p className={page.cardDescription}>Documentos vinculados ao lead original e aprovados na conversão.</p>
                </header>
                <div className={styles.docs}>{slots.documents}</div>
              </section>
            </TabsContent>

            <TabsContent value="timeline" className={styles.tabPanel}>
              {slots.timeline ?? (
                <div className={page.empty}>
                  <p className={page.emptyTitle}>Nenhuma interação registrada</p>
                  <p className={page.emptyText}>O histórico de interações deste cliente aparecerá aqui.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <aside className={styles.aside} aria-label="Dados do cliente">
          <section className={page.card} aria-labelledby="cliente-sobre">
            <h3 id="cliente-sobre" className={page.cardTitle}>Sobre o cliente</h3>
            <dl className={styles.asideFields}>
              <Field label="Telefone"><a className={styles.link} href={`tel:${client.phone.replace(/\D/g, "")}`}>{client.phone}</a></Field>
              <Field label="E-mail">{client.email ? <a className={styles.link} href={`mailto:${client.email}`}>{client.email}</a> : "Não informado"}</Field>
              <Field label="Unidade"><span className={styles.withIcon}><Building2 aria-hidden="true" size={14} />{client.branchName ?? "Sem filial"}</span></Field>
              <Field label="Responsável">{client.brokerName ?? "Não informado"}</Field>
            </dl>
          </section>

          <section className={page.card} aria-labelledby="cliente-dados">
            <header className={page.cardHead}>
              <h3 id="cliente-dados" className={page.cardTitle}>Dados organizados</h3>
              <p className={page.cardDescription}>Informações essenciais para continuar o relacionamento sem procurar em várias telas.</p>
            </header>
            <dl className={styles.asideFields}>
              <div className={styles.pairFields}>
                <Field label="Registro">Cliente</Field>
                <Field label="Documentos"><span className={page.numeric}>{documentCount}</span></Field>
              </div>
              {hideRegistrationDate ? null : <Field label="Cadastro"><span className={page.numeric}>{formatLiteDate(client.createdAt)}</span></Field>}
              <Field label="Aniversário">Ainda não informado</Field>
              <Field label="Consentimento LGPD"><span className={page.badge} data-tone={consentimentoLgpd ? "success" : undefined}>{consentimentoLgpd ? "Registrado" : "Pendente"}</span></Field>
            </dl>
            <div className={styles.divided}>
              <div className={styles.subHead}>
                <h4 className={styles.subTitle}>Dependentes</h4>
                <span className={page.badge}>{dependents.length}</span>
              </div>
              {dependents.length ? (
                <ul className={styles.lines}>
                  {dependents.map((dependent) => (
                    <li key={dependent.id}>
                      <span className={styles.lineLabel}>{dependent.name}{dependent.isHolder ? " · Titular" : ""}</span>
                      <span className={page.muted}>{dependent.relationship}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className={styles.hint}>Nenhum dependente cadastrado.</p>}
            </div>
            <p className={styles.note}>Use a aba Documentos para consultar requisitos, arquivos enviados e status de revisão.</p>
          </section>

          <section className={page.card} aria-labelledby="cliente-financeiro">
            <h3 id="cliente-financeiro" className={page.cardTitle}>Resumo financeiro</h3>
            <div className={styles.total}>
              <span className={page.muted}>Total em vendas</span>
              <span className={styles.totalValue}>{currency(totalSalesValue)}</span>
            </div>
            <dl className={styles.asideFields}>
              <div className={styles.inline}><dt>Vendas registradas</dt><dd className={page.numeric}>{sales.length}</dd></div>
              {activeCustomer ? (
                <div className={styles.inline}><dt>Status do contrato</dt><dd><span className={page.badge} data-tone={activeCustomer.status === "active" ? "success" : "danger"}>{activeCustomer.status === "active" ? "Ativo" : "Cancelado"}</span></dd></div>
              ) : null}
            </dl>
          </section>

          {activeCustomer ? (
            <section className={page.card} aria-labelledby="cliente-vigencia">
              <h3 id="cliente-vigencia" className={page.cardTitle}>Vigência e renovação</h3>
              <dl className={styles.asideFields}>
                <div className={styles.inline}><dt>Início da vigência</dt><dd className={page.numeric}>{dateOnly(activeCustomer.coverageStartDate)}</dd></div>
                <div className={styles.inline}><dt>Aniversário do contrato</dt><dd className={page.numeric}>{dateOnly(activeCustomer.contractAnniversary)}</dd></div>
              </dl>
              {days !== null ? (
                <p className={styles.note} data-tone={renewal.upcoming ? "warning" : undefined}>
                  {renewal.upcoming
                    ? `Renovação em ${days} dia${days !== 1 ? "s" : ""}`
                    : days < 0
                      ? `Vencido há ${Math.abs(days)} dias`
                      : `Próxima renovação em ${days} dias`}
                </p>
              ) : null}
              {activeCustomer.status === "cancelled" && activeCustomer.cancellationDate ? (
                <div className={styles.note} data-tone="danger">
                  <p className={styles.noteTitle}>Cancelamento</p>
                  <p>Cancelado em {dateOnly(activeCustomer.cancellationDate)}</p>
                  {activeCustomer.cancellationReason ? <p>Motivo: {activeCustomer.cancellationReason}</p> : null}
                </div>
              ) : null}
              <ClientRenewalLite
                activeCustomerId={activeCustomer.id}
                initialStatus={activeCustomer.renewalStatus}
                initialNotes={activeCustomer.renewalNotes}
                disabled={activeCustomer.status === "cancelled"}
              />
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
