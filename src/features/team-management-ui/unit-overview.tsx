import Link from "next/link";

import { Avatar } from "@/components/arc/avatar/avatar";
import { EmptyState } from "@/components/arc/empty-state/empty-state";

import { BAND_LABELS, exceptionPhrase, sortSupervisorsForComparison, sortTeamsByHealth } from "./health-order";
import { plainHealthPoint } from "./team-page";
import styles from "./unit-overview.module.css";
import type { HealthBand, KpiTrend, SupervisorRow, TeamHealthCard, UnitKpi, UnitOverview } from "./types";

const TREND_LABEL: Record<Exclude<KpiTrend, null>, string> = { up: "Subiu", flat: "Estável", down: "Caiu" };

function TrendMark({ trend, better }: { trend: KpiTrend; better: "up" | "down" }) {
  // Counts (brokers, teams) have no previous window: nothing to show next to them.
  if (!trend) return null;
  if (trend === "flat") return <span className={styles.trendFlat} aria-label={TREND_LABEL.flat}>→</span>;
  const improved = trend === better;
  return (
    <span className={improved ? styles.trendGood : styles.trendBad} aria-label={`${TREND_LABEL[trend]}${improved ? ", bom" : ", atenção"}`}>
      {trend === "up" ? "↑" : "↓"}
    </span>
  );
}

function KpiTile({ kpi }: { kpi: UnitKpi }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>{kpi.label}</span>
      {kpi.value === null ? (
        <strong className={styles.kpiSoon}>Sem dados</strong>
      ) : (
        <strong className={styles.kpiValue}>{kpi.value} <TrendMark trend={kpi.trend} better={kpi.better} /></strong>
      )}
    </div>
  );
}

function TeamCard({ team }: { team: TeamHealthCard }) {
  const hasScore = team.score !== null && team.band !== null;
  return (
    <article className={`${styles.card} ${styles.team}`} aria-labelledby={`team-${team.id}`}>
      <header className={styles.teamHead}>
        {!team.isUnassigned ? <Avatar name={team.supervisorName} src={team.image ?? undefined} size="md" /> : null}
        <div className={styles.teamIdentity}>
          <h3 id={`team-${team.id}`}>{team.teamName}</h3>
          <p>{team.isUnassigned ? "Sem supervisor" : team.supervisorName} · {team.brokers} {team.brokers === 1 ? "corretor" : "corretores"}</p>
        </div>
      </header>
      {hasScore ? (
        <div className={styles.scoreRow}>
          <strong className={styles.score}>{team.score}</strong>
          <span className={styles.band} data-band={team.band}>{BAND_LABELS[team.band as HealthBand]}</span>
        </div>
      ) : (
        <p className={styles.soon}>Indicadores em breve</p>
      )}
      {hasScore && (team.strengths.length || team.concerns.length) ? (
        <div className={styles.notes}>
          {team.strengths.length ? <div><span>Pontos fortes</span><ul>{team.strengths.slice(0, 2).map((item) => <li key={item}>{plainHealthPoint(item)}</li>)}</ul></div> : null}
          {team.concerns.length ? <div><span>Pontos de atenção</span><ul>{team.concerns.slice(0, 2).map((item) => <li key={item}>{plainHealthPoint(item)}</li>)}</ul></div> : null}
        </div>
      ) : null}
      {team.isUnassigned && team.brokerNames.length ? <ul className={styles.unassignedList}>{team.brokerNames.slice(0, 6).map((name) => <li key={name}>{name}</li>)}</ul> : null}
      {!team.isUnassigned ? <Link className={styles.openLink} href={`/gestao/equipes/${encodeURIComponent(team.supervisorId)}`}>Abrir equipe</Link> : null}
    </article>
  );
}

function SupervisorTable({ rows }: { rows: SupervisorRow[] }) {
  const sorted = sortSupervisorsForComparison(rows);
  const dash = "·";
  return (
    <>
      <table className={styles.compareTable}>
        <thead>
          <tr><th scope="col">Equipe</th><th scope="col">Corretores</th><th scope="col">SLA</th><th scope="col">Aceite</th><th scope="col">Conversão</th><th scope="col">Saúde</th><th scope="col">Tendência</th></tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.supervisorId}>
              <th scope="row">{row.name}</th>
              <td>{row.teamSize}</td>
              <td>{row.sla ?? dash}</td>
              <td>{row.acceptRate ?? dash}</td>
              <td>{row.conversion ?? dash}</td>
              <td>{row.score ?? dash}</td>
              <td><TrendMark trend={row.trend} better="up" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className={styles.compareList}>
        {sorted.map((row) => (
          <li key={row.supervisorId} className={styles.compareItem}>
            <strong>{row.name}</strong>
            <span>{row.teamSize} corretores</span>
            {row.score === null ? <span>Indicadores em breve</span> : (
              <>
                <span>Saúde {row.score} <TrendMark trend={row.trend} better="up" /></span>
                <span>SLA {row.sla ?? dash} · Aceite {row.acceptRate ?? dash} · Conversão {row.conversion ?? dash}</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function UnitOverviewView({ overview }: { overview: UnitOverview }) {
  const teams = sortTeamsByHealth(overview.teams);
  const baseException = exceptionPhrase(overview.teamsNeedingAttention, overview.metricsAvailable);
  const exception = overview.metricsAvailable && overview.unassignedNeedsAttention
    ? overview.teamsNeedingAttention > 0
      ? `${baseException}. O grupo Sem equipe também precisa de atenção.`
      : "O grupo Sem equipe precisa de atenção."
    : baseException;
  return (
    <div className={`arc-venancor ${styles.page}`}>
      <div className={styles.inner}>
        <header className={styles.heading}>
          <h1>Gestão da unidade</h1>
          <p className={styles.exception} data-attention={overview.teamsNeedingAttention > 0 || overview.unassignedNeedsAttention}>
            {exception}
          </p>
        </header>

        <section className={styles.kpis} aria-label="Resumo da unidade">
          {overview.kpis.map((kpi) => <KpiTile key={kpi.key} kpi={kpi} />)}
        </section>

        <section aria-labelledby="teams-health-title" className={styles.section}>
          <h2 id="teams-health-title">Saúde das equipes</h2>
          {teams.length ? (
            <div className={styles.teamGrid}>
              {teams.map((team) => <TeamCard key={team.id} team={team} />)}
            </div>
          ) : <EmptyState title="Nenhuma equipe ainda" description="Crie a equipe de um supervisor para ver a saúde aqui." />}
        </section>

        <section aria-labelledby="compare-title" className={styles.section}>
          <h2 id="compare-title">Comparar supervisores</h2>
          {overview.supervisors.length ? (
            <div className={`${styles.card} ${styles.compare}`}>
              <SupervisorTable rows={overview.supervisors} />
            </div>
          ) : <EmptyState title="Nenhum supervisor ativo" description="Os supervisores da unidade aparecem aqui para comparação." />}
        </section>
      </div>
    </div>
  );
}
