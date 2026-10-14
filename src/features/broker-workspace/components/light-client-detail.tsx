import Link from "next/link";

import { LitePageEnter, LiteList, LiteListItem } from "@/components/light/light-motion";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";

import styles from "./light-client-detail.module.css";

export type LightClientDetailData = {
  client: {
    id: string;
    leadId: string;
    name: string;
    phone: string | null;
    email: string | null;
    convertedAt: Date | string;
    branchName: string | null;
    brokerName: string | null;
  };
  activeCustomer: {
    status: string;
    coverageStartDate: string | null;
    contractAnniversary: string | null;
    expirationDate: string | null;
    renewalStatus: string;
    cancellationDate: string | null;
    cancellationReason: string | null;
  } | null;
  sales: { id: string; planName: string | null; carrierName: string | null; saleValue: string | null; policyNumber: string | null; status: string; saleDate: string | Date | null; brokerName: string | null }[];
  beneficiaries: { id: string; name: string; relationship: string | null; isHolder: boolean }[];
  documents: { id: string; filename: string; status: string; requirementName: string | null }[];
  timeline: { id: string; tipo: string; conteudo: string | null; userName: string | null; createdAt: Date | string }[];
};

const renewalLabels: Record<string, string> = {
  pending_window: "Acompanhar no prazo",
  in_renewal: "Renovação em andamento",
  renewed: "Renovado",
  churned: "Não renovado",
};

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Formats a stored `YYYY-MM-DD` day (no time zone shift) or a timestamp. */
function formatDay(value: string | Date | null | undefined) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return dateFormat.format(new Date(`${value}T00:00:00`));
  return dateFormat.format(new Date(value));
}

function daysUntil(day: string | null) {
  if (!day) return null;
  return Math.ceil((new Date(`${day}T00:00:00`).getTime() - Date.now()) / 86_400_000);
}

function money(value: string | null) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Ficha do cliente no visual Lite (gestor e supervisor). Os dados chegam já filtrados pelo escopo. */
export function LightClientDetail({ data }: { data: LightClientDetailData }) {
  const { client, activeCustomer, sales, beneficiaries, documents, timeline } = data;
  const cancelled = activeCustomer?.status === "cancelled";
  const renewalDay = activeCustomer?.expirationDate ?? activeCustomer?.contractAnniversary ?? null;
  const daysToRenewal = daysUntil(activeCustomer?.contractAnniversary ?? null);
  const renewalSoon = !cancelled && daysToRenewal !== null && daysToRenewal >= 0 && daysToRenewal <= 45;
  const waUrl = buildWhatsAppUrl(client.phone);
  const totalSales = sales.reduce((sum, sale) => sum + Number(sale.saleValue ?? 0), 0);

  return (
    <LitePageEnter className={`arc-venancor ${styles.page}`}>
      <Link href="/clientes" className={styles.back}>← Clientes</Link>

      <header className={styles.header}>
        <h1>{client.name}</h1>
        <p>Convertido em {dateFormat.format(new Date(client.convertedAt))}{client.branchName ? ` · ${client.branchName}` : ""}</p>
        <div className={styles.badges}>
          <span className={cancelled ? styles.badgeMuted : styles.badgeAccent}>{cancelled ? "Cliente cancelado" : "Cliente ativo"}</span>
          {renewalSoon ? <span className={styles.badgeAccent}>Renovação em {daysToRenewal} dias</span> : null}
        </div>
        <div className={styles.actions}>
          {waUrl ? (
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className={styles.secondaryAction}>WhatsApp</a>
          ) : null}
          <Link href={`/leads/${encodeURIComponent(client.leadId)}`} className={styles.secondaryAction}>Ver lead original</Link>
        </div>
      </header>

      <div className={styles.columns}>
        <div className={styles.column}>
          <section className={styles.panel} aria-labelledby="client-contact-title">
            <h2 id="client-contact-title">Contato</h2>
            <dl className={styles.facts}>
              <div><dt>Telefone</dt><dd>{client.phone ?? "Não informado"}</dd></div>
              <div><dt>E-mail</dt><dd>{client.email ?? "Não informado"}</dd></div>
              <div><dt>Corretor</dt><dd>{client.brokerName ?? "Não informado"}</dd></div>
              <div><dt>Unidade</dt><dd>{client.branchName ?? "Sem unidade"}</dd></div>
            </dl>
          </section>

          <section className={styles.panel} aria-labelledby="client-renewal-title">
            <h2 id="client-renewal-title">Renovação</h2>
            {activeCustomer ? (
              <dl className={styles.facts}>
                <div><dt>Início da vigência</dt><dd>{formatDay(activeCustomer.coverageStartDate) ?? "Não informado"}</dd></div>
                <div><dt>Aniversário do contrato</dt><dd>{formatDay(activeCustomer.contractAnniversary) ?? "Não informado"}</dd></div>
                <div><dt>Acompanhamento</dt><dd>{renewalLabels[activeCustomer.renewalStatus] ?? activeCustomer.renewalStatus}</dd></div>
                {renewalDay && daysToRenewal !== null && !cancelled ? (
                  <div><dt>Próxima renovação</dt><dd>{daysToRenewal < 0 ? `Vencido há ${Math.abs(daysToRenewal)} dias` : `Em ${daysToRenewal} dias`}</dd></div>
                ) : null}
                {cancelled ? (
                  <div>
                    <dt>Cancelamento</dt>
                    <dd>{formatDay(activeCustomer.cancellationDate) ?? "Data não informada"}{activeCustomer.cancellationReason ? ` · ${activeCustomer.cancellationReason}` : ""}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className={styles.empty}>Sem contrato ativo registrado para este cliente.</p>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="client-beneficiaries-title">
            <h2 id="client-beneficiaries-title">Beneficiários ({beneficiaries.length})</h2>
            {beneficiaries.length ? (
              <LiteList className={styles.list} label="Beneficiários">
                {beneficiaries.map((beneficiary) => (
                  <LiteListItem key={beneficiary.id}>
                    <strong>{beneficiary.name}</strong>
                    <small>{beneficiary.isHolder ? "Titular" : beneficiary.relationship ?? "Dependente"}</small>
                  </LiteListItem>
                ))}
              </LiteList>
            ) : (
              <p className={styles.empty}>Nenhum beneficiário cadastrado.</p>
            )}
          </section>
        </div>

        <div className={styles.column}>
          <section className={styles.panel} aria-labelledby="client-sales-title">
            <h2 id="client-sales-title">Vendas ({sales.length})</h2>
            {sales.length ? (
              <>
                <p className={styles.total}>Total em vendas <strong>{money(String(totalSales))}</strong></p>
                <LiteList className={styles.list} label="Vendas">
                  {sales.map((sale) => (
                    <LiteListItem key={sale.id}>
                      <strong>{[sale.carrierName, sale.planName].filter(Boolean).join(" · ") || "Venda"}</strong>
                      <small>
                        {money(sale.saleValue)}
                        {sale.policyNumber ? ` · Apólice ${sale.policyNumber}` : ""}
                        {formatDay(sale.saleDate) ? ` · ${formatDay(sale.saleDate)}` : ""}
                      </small>
                    </LiteListItem>
                  ))}
                </LiteList>
              </>
            ) : (
              <p className={styles.empty}>Nenhuma venda registrada.</p>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="client-documents-title">
            <h2 id="client-documents-title">Documentos ({documents.length})</h2>
            {documents.length ? (
              <LiteList className={styles.list} label="Documentos">
                {documents.map((document) => (
                  <LiteListItem key={document.id}>
                    <strong>{document.filename}</strong>
                    <small>{[document.requirementName, document.status.replaceAll("_", " ")].filter(Boolean).join(" · ")}</small>
                  </LiteListItem>
                ))}
              </LiteList>
            ) : (
              <p className={styles.empty}>Nenhum documento enviado.</p>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="client-timeline-title">
            <h2 id="client-timeline-title">Linha do tempo</h2>
            {timeline.length ? (
              <ol className={styles.timeline}>
                {timeline.map((item) => (
                  <li key={item.id}>
                    <span className={styles.dot} aria-hidden="true" />
                    <div>
                      <strong>{item.tipo.replaceAll("_", " ")}</strong>
                      {item.conteudo ? <p>{item.conteudo}</p> : null}
                      <small>{[item.userName, dateTimeFormat.format(new Date(item.createdAt))].filter(Boolean).join(" · ")}</small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.empty}>Nenhum registro na linha do tempo.</p>
            )}
          </section>
        </div>
      </div>
    </LitePageEnter>
  );
}
