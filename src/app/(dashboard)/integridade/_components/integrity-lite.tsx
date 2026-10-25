"use client";

/**
 * Integridade no visual Lite: os mesmos quatro números (com tendência de 7 dias onde existe), o feed de auditoria em
 * lista paginada no lugar da área de rolagem, e a saúde do sistema com o atalho para configurações.
 */
import Link from "next/link";
import { ArrowRight, CircleCheck, FileText, ShieldAlert } from "lucide-react";

import { StatCard } from "@/components/dashboard/metric-card";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { liteDateFormatter } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";

import styles from "./integrity-lite.module.css";

export type IntegrityLiteLog = { id: string; acao: string; entidade: string; entidadeId: string | null; userName: string; createdAt: string };
export type IntegrityLiteData = {
  stalled: number;
  unworked: number;
  totalLeads: number;
  leadsTrend: number[];
  auditsTrend: number[];
  logs: IntegrityLiteLog[];
};

const ACTION_LABELS: Record<string, string> = {
  create: "Criação",
  update: "Alteração",
  delete: "Exclusão",
  start_service: "Início de atendimento",
  convert: "Conversão",
  assign: "Atribuição",
  login: "Login",
  export: "Exportação",
};

const loggedAt = liteDateFormatter({ dateStyle: "short", timeStyle: "short" });

function sentence(text: string) {
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

/** "lead_task" vira "Lead task": caixa de frase, sem sublinhado. */
export function entityLabel(entity: string) {
  return sentence(entity.replace(/_/g, " "));
}

export function actionLabel(action: string) {
  return sentence(ACTION_LABELS[action] ?? action.replace(/_/g, " "));
}

const PAGE_SIZE = 10;

const HEALTH = [
  { id: "db", icon: CircleCheck, tone: "success", title: "Banco de dados" },
  { id: "webhooks", icon: CircleCheck, tone: "success", title: "Webhooks" },
  { id: "exports", icon: FileText, tone: "info", title: "Exportações" },
] as const;

export function IntegrityLite({ data }: { data: IntegrityLiteData }) {
  const { pageRows, pagination } = useLitePages(data.logs, PAGE_SIZE);
  const healthText: Record<(typeof HEALTH)[number]["id"], string> = {
    db: `Operacional, ${data.totalLeads.toLocaleString("pt-BR")} registros de leads`,
    webhooks: "Recebendo leads externos normalmente",
    exports: "Relatórios exportados com trilha de auditoria",
  };

  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <section className={page.group} aria-label="Resumo de integridade">
        <div className={page.toolbar}>
          <p className={page.muted}>Alertas de perda, estagnação, exportações e eventos de auditoria em um único painel de governança.</p>
          <span className={styles.alerts} aria-label="Situação">
            {data.stalled > 0 ? <span className={page.badge} data-tone="warning">Atenção: {data.stalled.toLocaleString("pt-BR")} estagnados</span> : null}
            {data.unworked > 0 ? <span className={page.badge} data-tone="danger">Crítico: {data.unworked.toLocaleString("pt-BR")} sem contato</span> : null}
            {data.stalled === 0 && data.unworked === 0 ? <span className={page.badge} data-tone="success">Tudo em dia</span> : null}
          </span>
        </div>
        <div className={page.stats}>
          <StatCard label="Estagnados" value={data.stalled} sublabel="leads sem avanço há mais de 3 dias" animated />
          <StatCard label="Não trabalhados" value={data.unworked} sublabel="leads distribuídos há mais de 15 min sem contato" animated animationDelay={0.06} />
          <StatCard label="Total de leads" value={data.totalLeads} sublabel="registros no banco de dados" sparklineData={data.leadsTrend} sparklineColor="var(--chart-1)" animated animationDelay={0.12} />
          <StatCard label="Eventos auditados" value={data.logs.length} sublabel="últimas 30 entradas" sparklineData={data.auditsTrend} sparklineColor="var(--chart-3)" animated animationDelay={0.18} />
        </div>
      </section>

      <div className={styles.columns}>
        <section className={page.card} aria-labelledby="integridade-auditoria">
          <div className={styles.cardHeadRow}>
            <div className={page.cardHead}>
              <h2 id="integridade-auditoria" className={page.sectionTitle}>Eventos de auditoria</h2>
              <p className={page.muted}>Registro detalhado de alterações e acessos no sistema</p>
            </div>
            <span className={page.badge}><ShieldAlert aria-hidden="true" size={14} />&nbsp;LGPD</span>
          </div>
          {data.logs.length === 0 ? (
            <p className={page.muted}>Nenhum evento de auditoria registrado ainda.</p>
          ) : (
            <>
              <ul className={styles.events} aria-label="Eventos de auditoria">
                {pageRows.map((log) => (
                  <li key={log.id} className={styles.event}>
                    <div className={styles.eventMain}>
                      <span className={styles.eventTitle}>
                        <span className={page.cellTitle}>{actionLabel(log.acao)}</span>
                        <span className={page.badge}>{entityLabel(log.entidade)}</span>
                      </span>
                      <span className={page.cellSub}>
                        {log.userName}
                        {log.entidadeId ? <span className={page.numeric}> · ID {log.entidadeId.slice(0, 8)}</span> : null}
                      </span>
                    </div>
                    <time className={`${page.cellSub} ${page.numeric}`} dateTime={log.createdAt}>{loggedAt.format(new Date(log.createdAt))}</time>
                  </li>
                ))}
              </ul>
              <LitePagination label="Páginas de eventos" {...pagination} />
            </>
          )}
        </section>

        <section className={page.card} aria-labelledby="integridade-sistema">
          <div className={page.cardHead}>
            <h2 id="integridade-sistema" className={page.sectionTitle}>Integridade do sistema</h2>
            <p className={page.muted}>Indicadores de saúde operacional</p>
          </div>
          <ul className={styles.health}>
            {HEALTH.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id} className={styles.healthItem}>
                  <Icon aria-hidden="true" size={18} className={styles.healthIcon} data-tone={item.tone} />
                  <span>
                    <span className={page.cellTitle}>{item.title}</span>
                    <span className={page.cellSub}>{healthText[item.id]}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <Link href="/settings" className={`${page.button} ${styles.fullButton}`}>
            Acessar configurações <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </section>
      </div>
    </div>
  );
}
