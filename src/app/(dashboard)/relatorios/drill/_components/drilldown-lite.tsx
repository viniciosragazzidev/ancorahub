"use client";

/**
 * Drill de relatórios no visual Lite: explicação, total e as listas Lite de corretores e de leads (tabela no desktop,
 * cartões no celular). A linha inteira do lead abre o lead (clique, Enter ou espaço), no lugar do link do nome.
 */
import { useRouter } from "next/navigation";

import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";

export type DrillLeadLite = { id: string; nome: string; status: string; brokerName: string | null; branchName: string | null; createdAt: string };
export type DrillBrokerLite = { brokerId: string; brokerName: string; activeLeads: number; capacity: number };

/** A explicação vem do serviço compartilhado com a tela atual: no Lite, sem crases de código e sem travessão. */
export function liteExplanation(text: string) {
  return text.replace(/`([^`]+)`/g, "$1").replace(/\s+—\s+/g, ": ");
}

/** Rótulo do status em caixa de frase ("Em atendimento"), como pede o contrato do Lite. */
export function liteStatusLabel(status: string) {
  const label = LEAD_STATUS_LABELS[status] ?? status;
  return label.charAt(0) + label.slice(1).toLocaleLowerCase("pt-BR");
}

const PAGE_SIZE = 20;

export function DrilldownLite({ explanation, total, rows, brokers }: { explanation: string; total: number; rows: DrillLeadLite[]; brokers: DrillBrokerLite[] }) {
  const router = useRouter();
  const { pageRows, pagination } = useLitePages(rows, PAGE_SIZE);

  const brokerColumns: LiteColumn<DrillBrokerLite>[] = [
    { id: "broker", label: "Corretor", primary: true, render: (broker) => <span className={page.cellTitle} title={broker.brokerName}>{broker.brokerName}</span> },
    { id: "active", label: "Leads ativos", numeric: true, render: (broker) => broker.activeLeads.toLocaleString("pt-BR") },
    { id: "capacity", label: "Capacidade", numeric: true, render: (broker) => broker.capacity.toLocaleString("pt-BR") },
    { id: "excess", label: "Excedente", numeric: true, render: (broker) => <span className={page.badge} data-tone="danger">+{(broker.activeLeads - broker.capacity).toLocaleString("pt-BR")}</span> },
  ];

  const leadColumns: LiteColumn<DrillLeadLite>[] = [
    { id: "name", label: "Nome", primary: true, render: (lead) => <span className={page.cellTitle} title={lead.nome}>{lead.nome}</span> },
    { id: "status", label: "Status", render: (lead) => <span className={page.badge}>{liteStatusLabel(lead.status)}</span> },
    { id: "broker", label: "Corretor", nowrap: true, render: (lead) => lead.brokerName ? <span title={lead.brokerName}>{lead.brokerName}</span> : <span className={page.muted}>Sem corretor</span> },
    { id: "branch", label: "Unidade", nowrap: true, render: (lead) => lead.branchName ? <span title={lead.branchName}>{lead.branchName}</span> : <span className={page.muted}>Sem unidade</span> },
    { id: "created", label: "Criado em", numeric: true, render: (lead) => formatLiteDate(lead.createdAt) },
  ];

  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <section className={page.group} aria-label="Resumo">
        <p className={page.muted}>{liteExplanation(explanation)}</p>
        <div className={`${page.stats} ${page.statsFill}`}>
          <div className={page.stat}>
            <span className={page.statLabel}>Total de registros</span>
            <span className={page.statValue}>{total.toLocaleString("pt-BR")}</span>
            {total > rows.length ? <span className={page.statHint}>Exibindo os {rows.length.toLocaleString("pt-BR")} primeiros</span> : null}
          </div>
        </div>
      </section>

      {brokers.length > 0 ? (
        <section className={page.group} aria-labelledby="drill-brokers-title">
          <h2 id="drill-brokers-title" className={page.sectionTitle}>Corretores</h2>
          <LiteResponsiveData caption="Corretores" columns={brokerColumns} rows={brokers} rowKey={(broker) => broker.brokerId} empty={<p>Nenhum corretor.</p>} />
        </section>
      ) : null}

      {rows.length > 0 ? (
        <section className={page.group} aria-labelledby="drill-leads-title">
          <h2 id="drill-leads-title" className={page.sectionTitle}>Leads</h2>
          <LiteResponsiveData caption="Leads" columns={leadColumns} rows={pageRows} rowKey={(lead) => lead.id} onRowOpen={(lead) => router.push(`/leads/${lead.id}`)} empty={<p>Nenhum lead.</p>} />
          <LitePagination label="Páginas de leads" {...pagination} />
          {total > rows.length ? <p className={page.muted}>Exibindo {rows.length.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")} registros.</p> : null}
        </section>
      ) : null}
    </div>
  );
}
