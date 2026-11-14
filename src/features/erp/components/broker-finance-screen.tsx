import Link from "next/link";
import type { CSSProperties } from "react";

import { formatBrokerCents, type BrokerFinanceDetail } from "../broker-finance-core";
import { formatCompetence, formatDay } from "../ui/format";
import { BrokerFinanceMonthChart } from "./broker-finance-charts";
import styles from "./broker-finance.module.css";

export type BrokerFinanceScreenState = { status: "ready"; data: BrokerFinanceDetail } | { status: "denied" } | { status: "error" };

const order = (index: number) => ({ "--i": index }) as CSSProperties;

function Empty({ title, text, alert, children }: { title: string; text: string; alert?: boolean; children?: React.ReactNode }) {
  return (
    <section className={`${styles.empty} ${styles.enter}`} role={alert ? "alert" : undefined}>
      <h2 className={styles.emptyTitle}>{title}</h2>
      <p className={styles.emptyText}>{text}</p>
      {children ? <div className={styles.actions}>{children}</div> : null}
    </section>
  );
}

function Metrics({ summary }: { summary: BrokerFinanceDetail["summary"] }) {
  const metrics = [
    { label: "A receber", cents: summary.receivableCents, hint: "Comissões conferidas que ainda não foram pagas a você" },
    { label: "Recebido no mês", cents: summary.receivedThisMonthCents, hint: `Pagamentos conferidos em ${summary.periodLabel}` },
    { label: "Adiantamentos em aberto", cents: summary.openAdvancesCents, hint: "Saldo de adiantamento ainda não descontado das comissões" },
  ];
  return (
    <dl className={styles.metrics}>
      {metrics.map((metric, index) => (
        <div key={metric.label} className={`${styles.metric} ${styles.enter}`} style={order(index)}>
          <dt className={styles.metricLabel}>{metric.label}</dt>
          <dd className={metric.cents === null ? styles.noData : styles.metricValue}>{formatBrokerCents(metric.cents)}</dd>
          <dd className={styles.metricHint}>{metric.cents === null ? "Ainda não há lançamento conferido para este número." : metric.hint}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Gráficos (recebido e previsto por mês) e os indicadores rápidos da carteira de comissões. */
function Insights({ insights, period }: { insights: NonNullable<BrokerFinanceDetail["insights"]>; period: string }) {
  const months = insights.received.length;
  const average = months > 0 ? Math.round(insights.receivedTotalCents / months) : 0;
  const next = insights.nextInstallment;
  const stats = [
    { label: "Vendas com comissão", value: String(insights.salesWithCommission), hint: null },
    { label: `Média recebida por mês`, value: formatBrokerCents(average), hint: `últimos ${months} meses` },
    { label: "Previsto nos próximos meses", value: formatBrokerCents(insights.forecastTotalCents), hint: "pelo cronograma" },
    { label: "Próxima parcela", value: next ? formatBrokerCents(next.amountCents) : "Nenhuma", hint: next ? `${next.clientName} · ${formatCompetence(next.referenceMonth)}` : "sem parcela pendente" },
  ];
  return (
    <section className={styles.section} aria-labelledby="broker-finance-insights">
      <div className={styles.sectionHead}>
        <h2 id="broker-finance-insights" className={styles.sectionTitle}>Evolução</h2>
        <p className={styles.sectionHint}>Comissões por mês</p>
      </div>
      <div className={styles.charts}>
        <div className={`${styles.chartCard} ${styles.enter}`} style={order(3)}>
          <div className={styles.chartHead}>
            <p className={styles.chartTitle}>Recebido nos últimos {months} meses</p>
            <p className={styles.chartTotal}>{formatBrokerCents(insights.receivedTotalCents)}</p>
          </div>
          <BrokerFinanceMonthChart points={insights.received} tone="paid" label="Comissões recebidas por mês" currentPeriod={period} />
        </div>
        <div className={`${styles.chartCard} ${styles.enter}`} style={order(4)}>
          <div className={styles.chartHead}>
            <p className={styles.chartTitle}>Previsto para os próximos meses</p>
            <p className={styles.chartTotal}>{formatBrokerCents(insights.forecastTotalCents)}</p>
          </div>
          <BrokerFinanceMonthChart points={insights.forecast} tone="forecast" label="Parcelas previstas por mês" currentPeriod={period} />
          <p className={styles.chartHint}>Parcelas pendentes no cronograma das suas vendas. O valor final é o que o financeiro conferir.</p>
        </div>
      </div>
      <dl className={styles.stats}>
        {stats.map((stat, index) => (
          <div key={stat.label} className={`${styles.stat} ${styles.enter}`} style={order(5 + index)}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
            {stat.hint ? <dd className={styles.statHint}>{stat.hint}</dd> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

function Commissions({ data }: { data: BrokerFinanceDetail["commissions"] }) {
  const { rows, page, hasNext } = data;
  return (
    <section className={styles.section} aria-labelledby="broker-finance-commissions">
      <div className={styles.sectionHead}>
        <h2 id="broker-finance-commissions" className={styles.sectionTitle}>Comissões por venda</h2>
        <p className={styles.sectionHint}>Prevista, conferida ou paga</p>
      </div>
      {rows.length === 0 && page === 1 ? (
        <Empty title="Nenhuma comissão registrada ainda" text="Quando uma venda sua tiver parcelas de comissão no cronograma, elas aparecem aqui com o estado de cada uma." />
      ) : rows.length === 0 ? (
        <Empty title="Nada nesta página" text="As comissões terminaram na página anterior.">
          <Link href="/meu-financeiro" className={styles.link}>Voltar ao início da lista</Link>
        </Empty>
      ) : (
        <ul className={`${styles.list} ${styles.enter}`} style={order(3)}>
          {rows.map((row) => (
            <li key={row.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>{row.clientName}</span>
                <span className={styles.rowMeta}>
                  {[row.product, `${row.installment}ª parcela`, formatCompetence(row.referenceMonth)].filter(Boolean).join(" · ")}
                  {row.source === "cronograma" && row.state !== "prevista" ? " · pelo cronograma" : ""}
                </span>
              </div>
              <div className={styles.rowSide}>
                <span className={styles.rowValue}>{formatBrokerCents(row.amountCents)}</span>
                <span className={styles.state} data-state={row.state}>{row.stateLabel}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {page > 1 || hasNext ? (
        <nav className={styles.pager} aria-label="Páginas das comissões">
          {page > 1 ? <Link href={page === 2 ? "/meu-financeiro" : `/meu-financeiro?pagina=${page - 1}`} className={styles.link}>Anteriores</Link> : <span />}
          <span className={styles.pagerInfo}>Página {page}</span>
          {hasNext ? <Link href={`/meu-financeiro?pagina=${page + 1}`} className={styles.link}>Próximas</Link> : <span />}
        </nav>
      ) : null}
    </section>
  );
}

function Payouts({ rows, receiptsHref }: { rows: BrokerFinanceDetail["payouts"]; receiptsHref: string | null }) {
  return (
    <section className={styles.section} aria-labelledby="broker-finance-payouts">
      <div className={styles.sectionHead}>
        <h2 id="broker-finance-payouts" className={styles.sectionTitle}>Repasses e recibos</h2>
        <p className={styles.sectionHint}>Repasses já conferidos</p>
      </div>
      {rows.length === 0 ? (
        <Empty title="Nenhum repasse conferido ainda" text="Quando o financeiro conferir um pagamento para você, o repasse e o recibo aparecem aqui." />
      ) : (
        <ul className={`${styles.list} ${styles.enter}`} style={order(4)}>
          {rows.map((row) => (
            <li key={row.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>Repasse de {formatCompetence(row.competence, "long")}</span>
                <span className={styles.rowMeta}>
                  {[`Pago em ${formatDay(row.occurredOn)}`, row.receiptNumber ? `Recibo ${row.receiptNumber}` : null].filter(Boolean).join(" · ")}
                </span>
                {row.receiptHref ? <Link href={row.receiptHref} className={styles.link} aria-label={`Ver recibo ${row.receiptNumber ?? ""} de ${formatCompetence(row.competence, "long")}`}>Ver recibo</Link> : null}
              </div>
              <div className={styles.rowSide}>
                <span className={styles.rowValue}>{formatBrokerCents(row.netCents)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {receiptsHref && rows.length > 0 ? <Link href={receiptsHref} className={styles.link}>Ver todos os meus recibos</Link> : null}
    </section>
  );
}

/** Meu financeiro (Lite), somente leitura: três números do mês, comissões por venda, repasses e recibos. */
export function BrokerFinanceScreen({ state }: { state: BrokerFinanceScreenState }) {
  if (state.status === "denied") {
    return (
      <div className={styles.page}>
        <Empty title="Seu financeiro ainda não está liberado" text="O financeiro é liberado pela direção da sua empresa. Quando a direção ativar o módulo financeiro para corretores e o acesso às suas comissões, seus valores aparecem aqui.">
          <Link href="/dashboard" className={styles.link}>Voltar ao Início</Link>
        </Empty>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className={styles.page}>
        <Empty alert title="Não foi possível carregar seu financeiro" text="Nenhum valor foi alterado. Tente de novo em instantes; se continuar, avise o financeiro da sua empresa.">
          <Link href="/meu-financeiro" className={styles.link}>Tentar novamente</Link>
          <Link href="/dashboard" className={styles.link}>Voltar ao Início</Link>
        </Empty>
      </div>
    );
  }
  const { data } = state;
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Meu financeiro</h1>
        <p className={styles.lead}>Seus valores em {data.summary.periodLabel}, como o financeiro da empresa conferiu. Somente leitura.</p>
      </header>
      <section className={styles.section} aria-labelledby="broker-finance-month">
        <h2 id="broker-finance-month" className={styles.sectionTitle}>Meu mês</h2>
        <Metrics summary={data.summary} />
      </section>
      {data.insights ? <Insights insights={data.insights} period={data.summary.period} /> : null}
      <Commissions data={data.commissions} />
      <Payouts rows={data.payouts} receiptsHref={data.receiptsHref} />
      <p className={styles.note}>Dúvida sobre algum valor? Fale com o financeiro da sua empresa. Esta tela não altera lançamentos.</p>
    </div>
  );
}
