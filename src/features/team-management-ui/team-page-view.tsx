import Link from "next/link";

import { EmptyState } from "@/components/arc/empty-state/empty-state";

import type { HealthTone, ManagerBlock, TeamKpi, TeamPageView } from "./team-page";
import styles from "./team-page-view.module.css";

const BAND_LABELS: Record<HealthTone, string> = { excelente: "Excelente", saudavel: "Saudável", atencao: "Atenção", critico: "Crítico" };
const SEVERITY_LABELS: Record<"critical" | "warning" | "info", string> = { critical: "Urgente", warning: "Atenção", info: "Informação" };

function TrendMark({ trend }: { trend: TeamKpi["trend"] }) {
  if (!trend) return null;
  if (trend === "flat") return <span className={styles.trendFlat} aria-label="Estável">→</span>;
  return trend === "up"
    ? <span className={styles.trendGood} aria-label="Melhorou">↑</span>
    : <span className={styles.trendBad} aria-label="Piorou">↓</span>;
}

function ManagerBlockView({ block }: { block: ManagerBlock }) {
  const groups: Array<{ key: string; title: string; names: string[] }> = [
    { key: "below", title: "Abaixo da média de aceite", names: block.belowAverage },
    { key: "evolving", title: "Evoluindo na conversão", names: block.evolving },
    { key: "inactive", title: "Sem atividade há 2 dias úteis", names: block.noActivity },
    { key: "critical", title: "Pendências críticas", names: block.criticalPending },
  ];
  return (
    <section className={`${styles.card} ${styles.managerBlock}`} aria-labelledby="manager-block-title">
      <h2 id="manager-block-title">Gestão do supervisor</h2>
      <div className={styles.managerGrid}>
        {groups.map((group) => (
          <div key={group.key} className={styles.managerGroup}>
            <span>{group.title}</span>
            {group.names.length ? <ul>{group.names.map((name) => <li key={name}>{name}</li>)}</ul> : <p>Ninguém neste ponto</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function TeamPageViewComponent({ view }: { view: TeamPageView }) {
  const maxLeads = Math.max(1, ...view.load.brokers.map((broker) => broker.activeLeads));
  return (
    <div className={`arc-venancor ${styles.page}`}>
      <div className={styles.inner}>
        <section className={`${styles.card} ${styles.header}`} aria-labelledby="team-title">
          <div className={styles.identity}>
            <p className={styles.eyebrow}>{view.viewer === "gestor" ? "Equipe do supervisor" : "Minha equipe"}</p>
            <h1 id="team-title">{view.teamName}</h1>
            <p className={styles.muted}>{view.supervisorName} · {view.brokersCount} {view.brokersCount === 1 ? "corretor" : "corretores"}</p>
          </div>
          <div className={styles.score}>
            <strong>{view.health.score}</strong>
            <span data-band={view.health.band}>{BAND_LABELS[view.health.band]}</span>
          </div>
          <div className={styles.notes}>
            {view.health.strongPoints.length ? <div><span>Pontos fortes</span><ul>{view.health.strongPoints.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
            {view.health.attentionPoints.length ? <div><span>Pontos de atenção</span><ul>{view.health.attentionPoints.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
          </div>
        </section>

        <section className={`${styles.card} ${styles.kpis}`} aria-label="Números da equipe, últimos 7 dias">
          {view.kpis.map((kpi) => (
            <div key={kpi.key} className={styles.kpi}>
              <span>{kpi.label}</span>
              <strong>{kpi.value} <TrendMark trend={kpi.trend} /></strong>
            </div>
          ))}
        </section>

        <section className={styles.section} aria-labelledby="needs-you-title">
          <h2 id="needs-you-title">Precisam de você</h2>
          {view.attention.length ? (
            <ul className={styles.attentionList}>
              {view.attention.map((card) => (
                <li key={card.id} className={`${styles.card} ${styles.attention}`} data-severity={card.severity}>
                  <span className={styles.severity}>{SEVERITY_LABELS[card.severity]}</span>
                  <p>{card.message}</p>
                  <div className={styles.links}>
                    {card.links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.card}>
              <EmptyState title="Ninguém precisa de você agora" description="Quando um corretor ou a equipe pedir atenção, o aviso aparece aqui." />
            </div>
          )}
        </section>

        <section className={`${styles.card} ${styles.load}`} aria-labelledby="load-title">
          <div className={styles.sectionHeading}>
            <h2 id="load-title">Carga da equipe</h2>
            <span>média {view.load.average.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} leads</span>
          </div>
          {view.load.brokers.length ? (
            <ul className={styles.bars}>
              {view.load.brokers.map((broker) => (
                <li key={broker.id}>
                  <span>{broker.name}</span>
                  <span className={styles.track}><i style={{ width: `${Math.round(broker.activeLeads / maxLeads * 100)}%` }} data-over={broker.overThreshold} /></span>
                  <strong>{broker.activeLeads}</strong>
                  {broker.overThreshold ? <small>mais de 50% acima da média</small> : null}
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Sem corretores na equipe" description="Os corretores da equipe aparecem aqui." />}
        </section>

        <section className={`${styles.card} ${styles.goal}`} aria-labelledby="goal-title">
          <h2 id="goal-title">Meta da equipe</h2>
          {view.goal ? (
            <>
              <p>{view.goal.name}</p>
              <span className={styles.track}><i style={{ width: `${Math.min(100, view.goal.percentage)}%` }} /></span>
              <small>{view.goal.currentValue} de {view.goal.targetValue} · {view.goal.percentage}%</small>
            </>
          ) : <p className={styles.muted}>Nenhuma meta ativa para esta equipe.</p>}
        </section>

        {view.managerBlock ? <ManagerBlockView block={view.managerBlock} /> : null}
      </div>
    </div>
  );
}
