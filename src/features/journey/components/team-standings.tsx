"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotionConfig } from "motion/react";

import { Avatar } from "@/components/arc/avatar/avatar";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import type { LeaderboardBroker, LeaderboardTeam, TeamInternalLeaderboard, TeamLeaderboard } from "@/features/engagement/journey-types";

import { Podium } from "./podium";
import styles from "./team-standings.module.css";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];
const pts = (value: number) => `${Math.round(value).toLocaleString("pt-BR")} ${Math.round(Math.abs(value)) === 1 ? "pt" : "pts"}`;

export type TeamStandingsData = {
  supervisorId: string;
  internal: TeamInternalLeaderboard | null;
  /** Between teams of the unit (team ranking flag on), or null. */
  teams: TeamLeaderboard | null;
};

/**
 * Supervisor's "Desempenho da equipe": the team's own board (podium + every
 * broker with a growing bar) and, when on, the board between teams of the unit
 * ranked by points per active broker.
 */
export function TeamStandings({ data, initialTab = "team" }: { data: TeamStandingsData; initialTab?: "team" | "teams" }) {
  const [tab, setTab] = useState<"team" | "teams">(initialTab);
  const ownTeam = data.teams?.teams.find((team) => team.supervisorId === data.supervisorId) ?? null;
  return (
    <div className={`arc-venancor ${styles.page}`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1>Desempenho da equipe</h1>
          <p>{ownTeam && data.teams ? <>Sua equipe está em <strong>{ownTeam.position}º de {data.teams.teams.length}</strong> na unidade nesta semana.</> : "Pontos da semana, zerados toda segunda."}</p>
        </header>

        {data.teams ? (
          <SegmentedControl label="Placar" value={tab} onValueChange={(value) => setTab(value as "team" | "teams")} options={[{ value: "team", label: "Minha equipe" }, { value: "teams", label: "Entre equipes" }]} />
        ) : null}

        {tab === "team" || !data.teams ? <InternalBoard board={data.internal} /> : <TeamsBoard board={data.teams} ownId={data.supervisorId} />}
      </div>
    </div>
  );
}

function Change({ value }: { value: number | null }) {
  if (!value) return <span className={styles.change} data-tone="same" aria-label="Mesma posição">=</span>;
  return <span className={styles.change} data-tone={value > 0 ? "up" : "down"} aria-label={value > 0 ? `Subiu ${value}` : `Caiu ${Math.abs(value)}`}>{value > 0 ? "▲" : "▼"} {Math.abs(value)}</span>;
}

function InternalBoard({ board }: { board: TeamInternalLeaderboard | null }) {
  const reduce = useReducedMotionConfig();
  if (!board || !board.brokers.length) {
    return <EmptyState title="Ninguém pontuou ainda nesta semana" description="Quando a equipe atender, o pódio e o placar aparecem aqui." action={<Link className={styles.link} href="/equipe/minha">Ver minha equipe</Link>} />;
  }
  const leader = Math.max(1, ...board.brokers.map((broker) => broker.points));
  return (
    <div className={styles.stack}>
      {board.brokers.length >= 2 ? (
        <Podium label="Pódio da equipe" entries={board.brokers.slice(0, 3).map((broker) => ({ id: broker.brokerId, name: broker.name, imageUrl: broker.imageUrl, position: broker.position, value: pts(broker.points) }))} />
      ) : null}
      <ol className={styles.rows} aria-label="Placar da equipe">
        {board.brokers.map((broker, index) => <BrokerRow key={broker.brokerId} broker={broker} share={broker.points / leader} index={index} reduce={Boolean(reduce)} />)}
      </ol>
    </div>
  );
}

function BrokerRow({ broker, share, index, reduce }: { broker: LeaderboardBroker; share: number; index: number; reduce: boolean }) {
  return (
    <li>
      <Link href={`/equipe/${encodeURIComponent(broker.brokerId)}`} className={styles.row} data-top={broker.position <= 3}>
        <span className={styles.position}>{broker.position}º</span>
        <Avatar name={broker.name} src={broker.imageUrl ?? undefined} size="md" />
        <span className={styles.rowMain}>
          <span className={styles.rowTop}><strong>{broker.name}</strong><span className={styles.points}>{pts(broker.points)}</span></span>
          <span className={styles.track} aria-hidden="true">
            <motion.i initial={{ width: reduce ? `${share * 100}%` : "0%" }} animate={{ width: `${Math.max(2, share * 100)}%` }} transition={reduce ? { duration: 0 } : { duration: 0.7, ease: EASE, delay: 0.2 + Math.min(index, 10) * 0.05 }} />
          </span>
        </span>
        <Change value={broker.positionChange} />
      </Link>
    </li>
  );
}

function TeamsBoard({ board, ownId }: { board: TeamLeaderboard; ownId: string }) {
  const reduce = useReducedMotionConfig();
  if (board.teams.length < 2) {
    return <EmptyState title="Só a sua equipe pontuou até agora" description="Quando outras equipes da unidade pontuarem, a disputa aparece aqui." />;
  }
  const leader = Math.max(1, ...board.teams.map((team) => team.averagePoints));
  return (
    <div className={styles.stack}>
      <Podium label="Pódio das equipes" fullName entries={board.teams.slice(0, 3).map((team) => ({ id: team.supervisorId, name: team.name, imageUrl: team.imageUrl, position: team.position, value: `${pts(team.averagePoints)}/corretor`, highlight: team.supervisorId === ownId, highlightLabel: "Sua equipe" }))} />
      <p className={styles.note}>Média de pontos por corretor ativo, para equipe grande e pequena disputarem no mesmo nível.</p>
      <ol className={styles.rows} aria-label="Placar entre equipes">
        {board.teams.map((team, index) => <TeamRow key={team.supervisorId} team={team} own={team.supervisorId === ownId} share={team.averagePoints / leader} index={index} reduce={Boolean(reduce)} />)}
      </ol>
    </div>
  );
}

function TeamRow({ team, own, share, index, reduce }: { team: LeaderboardTeam; own: boolean; share: number; index: number; reduce: boolean }) {
  return (
    <li className={styles.row} data-own={own} data-top={team.position <= 3}>
      <span className={styles.position}>{team.position}º</span>
      <Avatar name={team.name} src={team.imageUrl ?? undefined} size="md" />
      <span className={styles.rowMain}>
        <span className={styles.rowTop}>
          <strong>{own ? `${team.name} (sua)` : team.name}</strong>
          <span className={styles.points}>{pts(team.averagePoints)}</span>
        </span>
        <span className={styles.track} aria-hidden="true">
          <motion.i initial={{ width: reduce ? `${share * 100}%` : "0%" }} animate={{ width: `${Math.max(2, share * 100)}%` }} transition={reduce ? { duration: 0 } : { duration: 0.7, ease: EASE, delay: 0.2 + Math.min(index, 10) * 0.05 }} />
        </span>
        <small className={styles.rowMeta}>{team.activeBrokers} {team.activeBrokers === 1 ? "corretor" : "corretores"} · {pts(team.totalPoints)} no total</small>
      </span>
      <Change value={team.positionChange} />
    </li>
  );
}

