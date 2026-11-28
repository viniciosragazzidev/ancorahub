"use client";

/**
 * Visão geral do pós-venda (24/11): números do período, funil do envio até a resposta, pesquisas por regra e por
 * dia, e os alertas abertos. Clicar numa regra ou num dia leva para a lista de leads já filtrada.
 */
import { useState } from "react";
import Link from "next/link";

import { BrokerProfileLink } from "@/components/broker-profile-link";
import { LiteActionButton } from "@/components/lite/controls";
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { markPostSaleAlertHandledAction } from "@/features/post-sale-audit/actions";
import { POST_SALE_ALERT_REASON_LABELS } from "@/features/post-sale-audit/alert-rules";
import type { PostSaleOpenAlert } from "@/features/post-sale-audit/queries";
import { postSaleFunnel, type DayBreakdown, type PostSaleListFilters, type PostSaleOverviewSummary, type RuleBreakdown } from "@/features/post-sale-audit/overview";

import { PostSaleDayColumns, PostSaleFunnel, PostSaleLegend, PostSaleRuleBars } from "./post-sale-charts";
import styles from "./post-sale.module.css";

const fmt = (value: number) => value.toLocaleString("pt-BR");
const pct = (part: number, total: number) => total ? `${Math.round((part / total) * 100)}% das enviadas` : "Sem envios";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={page.stat}>
      <span className={page.statLabel}>{label}</span>
      <span className={page.statValue}>{value}</span>
      {hint ? <span className={page.statHint}>{hint}</span> : null}
    </div>
  );
}

const ALERTS_SHOWN = 5;

export function PostSaleOverview({ summary, rules, days, alerts, periodDays, onFilter, onAlertHandled }: {
  summary: PostSaleOverviewSummary;
  rules: RuleBreakdown[];
  days: DayBreakdown[];
  alerts: PostSaleOpenAlert[];
  periodDays: number;
  /** Leva para a lista de leads com esses filtros. */
  onFilter: (patch: Partial<PostSaleListFilters>) => void;
  onAlertHandled: () => Promise<void>;
}) {
  const [allAlerts, setAllAlerts] = useState(false);
  const shownAlerts = allAlerts ? alerts : alerts.slice(0, ALERTS_SHOWN);

  return (
    <div className={page.stack}>
      <section className={page.group} aria-label="Resumo do período">
        <div className={page.stats}>
          <Stat label="Enviadas" value={fmt(summary.sent)} hint={summary.queued ? `${fmt(summary.queued)} na fila` : `últimos ${periodDays} dias`} />
          <Stat label="Entregues" value={fmt(summary.delivered)} hint={pct(summary.delivered, summary.sent)} />
          <Stat label="Lidas" value={fmt(summary.read)} hint={pct(summary.read, summary.sent)} />
          <Stat label="Respondidas" value={fmt(summary.responded)} hint={pct(summary.responded, summary.sent)} />
          <Stat label="Em andamento" value={fmt(summary.inProgress)} hint={`${fmt(summary.completed)} concluídas`} />
          <Stat label="Sem resposta" value={fmt(summary.noReply)} hint="enviadas sem retorno" />
          <Stat label="Pediram para parar" value={fmt(summary.optedOut)} hint="opt-out" />
          <Stat label="Nota média" value={summary.averageRating === null ? "Sem notas" : `${summary.averageRating.toLocaleString("pt-BR")}/5`} hint={summary.ratingCount ? `${fmt(summary.ratingCount)} ${summary.ratingCount === 1 ? "nota" : "notas"}` : undefined} />
        </div>
        {summary.failed ? (
          <p className={page.muted}>
            {fmt(summary.failed)} {summary.failed === 1 ? "pesquisa não saiu" : "pesquisas não saíram"} (falha no canal ou número).{" "}
            <button type="button" className={page.cellLink} onClick={() => onFilter({ stage: "failed" })}>Ver quais</button>
          </p>
        ) : null}
      </section>

      <div className={styles.charts}>
        <section className={page.card} aria-labelledby="pos-venda-funil">
          <div className={page.cardHead}>
            <h2 id="pos-venda-funil" className={page.cardTitle}>Do envio à resposta</h2>
          </div>
          <PostSaleFunnel steps={postSaleFunnel(summary)} />
        </section>

        <section className={page.card} aria-labelledby="pos-venda-regras">
          <div className={page.cardHead}>
            <h2 id="pos-venda-regras" className={page.cardTitle}>Por regra</h2>
          </div>
          <PostSaleRuleBars rules={rules} onSelect={(key) => onFilter({ rule: key })} />
          <PostSaleLegend />
        </section>

        <section className={`${page.card} ${styles.chartWide}`} aria-labelledby="pos-venda-dias">
          <div className={styles.cardHeadRow}>
            <div className={page.cardHead}>
              <h2 id="pos-venda-dias" className={page.cardTitle}>Por dia de envio</h2>
            </div>
            <PostSaleLegend />
          </div>
          <PostSaleDayColumns days={days} onSelect={(day) => onFilter({ day })} />
        </section>
      </div>

      <section className={page.card} aria-labelledby="pos-venda-alertas">
        <div className={page.cardHead}>
          <h2 id="pos-venda-alertas" className={page.cardTitle}>Alertas abertos ({fmt(alerts.length)})</h2>
        </div>
        {alerts.length ? (
          <ul className={styles.alertList}>
            {shownAlerts.map((alert) => (
              <li key={alert.surveyId} className={styles.alertItem}>
                <div className={styles.alertText}>
                  <span className={page.cellTitle}>{alert.leadName}</span>
                  <span className={page.cellSub}>
                    {alert.brokerId ? <BrokerProfileLink brokerId={alert.brokerId} name={alert.brokerName} /> : alert.brokerName} · {alert.reasons.map((reason) => POST_SALE_ALERT_REASON_LABELS[reason]).join("; ")} · {formatLiteDate(alert.occurredAt, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {alert.detail ? <span className={styles.detail}>{alert.detail}</span> : null}
                </div>
                <div className={styles.actions}>
                  <Link className={page.button} href={`/leads/${encodeURIComponent(alert.leadId)}`}>Abrir lead</Link>
                  <LiteActionButton
                    size="sm"
                    tone="secondary"
                    busyLabel="Marcando…"
                    doneLabel="Tratado"
                    keeps="O alerta continua aberto."
                    onAction={async () => {
                      const result = await markPostSaleAlertHandledAction(alert.surveyId);
                      if (!result.ok) return { ok: false, error: result.error };
                      await onAlertHandled();
                      return { ok: true };
                    }}
                  >
                    Marcar como tratado
                  </LiteActionButton>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className={page.muted}>Nenhum alerta aberto.</p>}
        {alerts.length > ALERTS_SHOWN ? (
          <button type="button" className={page.cellLink} aria-expanded={allAlerts} onClick={() => setAllAlerts((value) => !value)}>
            {allAlerts ? "Mostrar menos" : `Ver todos os ${fmt(alerts.length)}`}
          </button>
        ) : null}
      </section>
    </div>
  );
}
