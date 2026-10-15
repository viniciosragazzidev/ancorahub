import Link from "next/link";

import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Button } from "@/components/ui/button";

import type { AlertSeverity, BrokerAttention, HealthTone, ManagerBlock, TeamKpi, TeamPageView } from "./team-page";
import { nobodyNeedsYou } from "./team-page";
import styles from "./team-page-view.module.css";

const BAND_LABELS: Record<HealthTone, string> = { excelente: "Excelente", saudavel: "Saudável", atencao: "Atenção", critico: "Crítico" };
const BAND_TONE: Record<HealthTone, BadgeTone> = { excelente: "success", saudavel: "neutral", atencao: "warning", critico: "danger" };
const SEVERITY_LABEL: Record<AlertSeverity, string> = { critical: "Urgente", warning: "Atenção", info: "Informação" };
const SEVERITY_TONE: Record<AlertSeverity, BadgeTone> = { critical: "danger", warning: "warning", info: "info" };

function TrendMark({ trend }: { trend: TeamKpi["trend"] }) {
  if (!trend) return null;
  if (trend === "flat") return <span className={styles.trendFlat} aria-label="Estável">→</span>;
  return trend === "up"
    ? <span className={styles.trendGood} aria-label="Melhorou">↑</span>
    : <span className={styles.trendBad} aria-label="Piorou">↓</span>;
}

function BrokerCard({ item }: { item: BrokerAttention }) {
  return (
    <li className={`${styles.card} ${styles.brokerCard}`} data-severity={item.severity}>
      <div className={styles.brokerHead}>
        <Avatar name={item.name} src={item.image ?? undefined} size="md" />
        <div className={styles.brokerIdentity}>
          <strong>{item.name}</strong>
          <Badge tone={SEVERITY_TONE[item.severity]} size="sm">{SEVERITY_LABEL[item.severity]}</Badge>
        </div>
      </div>
      <p className={styles.brokerMessage}>{item.message}</p>
      {item.badges.length ? (
        <div className={styles.badges}>
          {item.badges.map((badge) => <Badge key={badge.id} tone="neutral" size="sm">{badge.label}</Badge>)}
        </div>
      ) : null}
      <div className={styles.actions}>
        <Button render={<Link href={`/equipe/${encodeURIComponent(item.brokerId)}`} />} size="sm" variant="outline">Abrir corretor</Button>
        {item.lead ? <Button render={<Link href={`/leads/${encodeURIComponent(item.lead.leadId)}`} />} size="sm" variant="outline">Abrir lead</Button> : null}
        <Button render={<Link href={`/relacionamento?brokerId=${encodeURIComponent(item.brokerId)}`} />} size="sm" variant="outline">Cobrar</Button>
      </div>
    </li>
  );
}

function ManagerBlockView({ block }: { block: ManagerBlock }) {
  const groups: Array<{ key: string; title: string; names: string[] }> = [
    { key: "below", title: "Abaixo da média de aceite", names: block.belowAverage },
    { key: "evolving", title: "Evoluindo na conversão", names: block.evolving },
    { key: "inactive", title: "Sem atividade há 2 dias úteis", names: block.noActivity },
    { key: "critical", title: "Pendências críticas", names: block.criticalPending },
  ];
  return (
    <section className={styles.section} aria-labelledby="manager-block-title">
      <h2 id="manager-block-title">Gestão do supervisor</h2>
      <div className={styles.managerGrid}>
        {groups.map((group) => (
          <div key={group.key} className={styles.tile}>
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
            <h1 id="team-title">{view.teamName}</h1>
            <p className={styles.muted}>{view.supervisorName} · {view.brokersCount} {view.brokersCount === 1 ? "corretor" : "corretores"}</p>
            {view.teamSummary ? <p className={styles.summary}>{view.teamSummary}</p> : null}
          </div>
          <div className={styles.score}>
            <strong>{view.health.score}</strong>
            <Badge tone={BAND_TONE[view.health.band]}>{BAND_LABELS[view.health.band]}</Badge>
          </div>
          <div className={styles.notes}>
            {view.health.strongPoints.length ? <div><span>Pontos fortes</span><ul>{view.health.strongPoints.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
            {view.health.attentionPoints.length ? <div><span>Pontos de atenção</span><ul>{view.health.attentionPoints.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
          </div>
        </section>

        <section className={styles.kpis} aria-label="Números da equipe, últimos 7 dias">
          {view.kpis.map((kpi) => (
            <div key={kpi.key} className={styles.kpi}>
              <span>{kpi.label}</span>
              <strong>{kpi.value} <TrendMark trend={kpi.trend} /></strong>
            </div>
          ))}
        </section>

        <section className={styles.section} aria-labelledby="needs-you-title">
          <h2 id="needs-you-title">Precisam de você</h2>
          {nobodyNeedsYou(view) ? (
            <div className={styles.card}>
              <EmptyState title="Ninguém precisa de você agora" description="Quando um corretor ou a equipe pedir atenção, o aviso aparece aqui." />
            </div>
          ) : (
            <ul className={styles.brokerList}>
              {view.attention.map((item) => <BrokerCard key={item.brokerId} item={item} />)}
            </ul>
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
