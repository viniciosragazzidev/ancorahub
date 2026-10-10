"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotionConfig, type Transition } from "motion/react";

import { AnimatedCounter } from "@/components/arc/animated-counter/animated-counter";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import type {
  BrokerJourneyData, JourneyAchievement, JourneyMissionCard, MissionMetric, UnitLeaderboard,
} from "@/features/engagement/journey-types";

import { BadgeArt } from "./badge-art";
import { LEVEL_HUE, LevelRing } from "./level-ring";
import { Podium } from "./podium";
import styles from "./journey.module.css";

export type JourneyLedgerItem = BrokerJourneyData["ledger"][number];
export type JourneyScreenData = BrokerJourneyData;

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];
const dayFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit" });
const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
const pts = (value: number) => `${value.toLocaleString("pt-BR")} ${Math.abs(value) === 1 ? "pt" : "pts"}`;

/** Icon per mission metric; a metric without one falls back to a target. */
const METRIC_ICON: Partial<Record<MissionMetric | "steps.coverage", string>> = {
  "contacts.fast_coverage": "M13 2 4 14h7l-1 8 9-12h-7z",
  "contacts.on_time": "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  "contacts.evidenced": "M4 5h16v11H8l-4 4z",
  "contacts.days_on_time": "M7 3v3M17 3v3M4 8h16M5 5h14v15H5zM9 14l2 2 4-4",
  "returns.cleared": "M21 12a9 9 0 1 1-3-6.7M21 4v5h-5",
  "notes.coverage": "M5 4h11l3 3v13H5zM9 10h6M9 14h6",
  "offers.fast_coverage": "M5 12l4 4 10-10",
  "sla.no_breach": "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z",
  "steps.coverage": "M4 6h4v4H4zM10 8h10M4 14h4v4H4zM10 16h10",
};
const DEFAULT_ICON = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z";

export function JourneyScreen({ data }: { data: JourneyScreenData }) {
  const reduce = useReducedMotionConfig();
  const rise = (index: number): Transition => (reduce ? { duration: 0 } : { duration: 0.45, ease: EASE, delay: 0.06 * index });
  const enter = reduce ? false : { opacity: 0, y: 10 };
  const daily = data.missions.filter((mission) => mission.kind === "daily" || mission.kind === "campaign" || mission.kind === "team");
  const weekly = data.missions.filter((mission) => mission.kind === "weekly");

  return (
    <div className={`arc-venancor ${styles.page}`}>
      <div className={styles.inner}>
        <motion.header className={styles.pageHeader} initial={enter} animate={{ opacity: 1, y: 0 }} transition={rise(0)}>
          <h1>Minha jornada</h1>
          <p>Seus pontos vêm só do que você fez de verdade no atendimento.</p>
        </motion.header>

        <motion.div initial={enter} animate={{ opacity: 1, y: 0 }} transition={rise(1)}>
          <JourneyHero data={data} />
        </motion.div>

        <motion.section className={styles.section} aria-labelledby="journey-missions" initial={enter} animate={{ opacity: 1, y: 0 }} transition={rise(2)}>
          <div className={styles.sectionHead}>
            <h2 id="journey-missions">Missões de hoje</h2>
            {daily.length ? <span className={styles.sectionNote}>{daily.filter((mission) => mission.progress.completed).length} de {daily.length} concluídas</span> : null}
          </div>
          {daily.length ? (
            <ul className={styles.missionList}>
              {daily.map((mission, index) => <MissionCard key={mission.id} mission={mission} index={index} />)}
            </ul>
          ) : <p className={styles.quiet}>As missões aparecem quando o seu dia começa.</p>}
        </motion.section>

        {weekly.length ? (
          <motion.section className={styles.section} aria-labelledby="journey-weekly" initial={enter} animate={{ opacity: 1, y: 0 }} transition={rise(3)}>
            <div className={styles.sectionHead}><h2 id="journey-weekly">Da semana</h2></div>
            <ul className={styles.missionList}>
              {weekly.map((mission, index) => <MissionCard key={mission.id} mission={mission} index={index} />)}
            </ul>
          </motion.section>
        ) : null}

        <motion.section className={styles.section} aria-labelledby="journey-board" initial={enter} animate={{ opacity: 1, y: 0 }} transition={rise(4)}>
          <div className={styles.sectionHead}>
            <h2 id="journey-board">Placar da unidade</h2>
            <span className={styles.sectionNote}>Zera toda segunda</span>
          </div>
          <UnitBoard board={data.leaderboard} optedOut={Boolean(data.optedOut)} />
        </motion.section>

        <motion.section className={styles.section} aria-labelledby="journey-badges" initial={enter} animate={{ opacity: 1, y: 0 }} transition={rise(5)}>
          <div className={styles.sectionHead}>
            <h2 id="journey-badges">Conquistas</h2>
            <span className={styles.sectionNote}>{data.achievements.filter((item) => item.earned).length} de {data.achievements.filter((item) => item.enabled).length}</span>
          </div>
          <AchievementGrid items={data.achievements} />
        </motion.section>

        {data.ledger ? (
          <motion.section id="extrato" className={`${styles.section} ${styles.anchor}`} aria-labelledby="journey-ledger" initial={enter} animate={{ opacity: 1, y: 0 }} transition={rise(6)}>
            <div className={styles.sectionHead}><h2 id="journey-ledger">De onde vieram seus pontos</h2></div>
            <PointsLedger items={data.ledger} />
          </motion.section>
        ) : null}
      </div>
    </div>
  );
}

function JourneyHero({ data }: { data: JourneyScreenData }) {
  const { level, week, streak } = data;
  const hue = LEVEL_HUE[Math.min(LEVEL_HUE.length - 1, level.level.index)];
  const change = week.pointsChange;
  return (
    <section className={styles.hero} style={{ "--level-hue": hue } as React.CSSProperties} aria-label="Seu nível e sua semana">
      <LevelRing index={level.level.index} percentage={level.percentage} />
      <div className={styles.heroText}>
        <span className={styles.heroLevel}>{level.level.name}</span>
        <span className={styles.heroPoints}>
          <AnimatedCounter value={week.points} locale="pt-BR" />
          <small>pts nesta semana</small>
        </span>
        <span className={styles.heroChips}>
          {change !== 0 ? <span className={styles.chip} data-tone={change > 0 ? "up" : "down"}>{change > 0 ? "▲" : "▼"} {pts(Math.abs(change))} vs semana passada</span> : null}
          {streak.current > 0 ? (
            <span className={styles.chip} data-tone="streak" aria-label={`Sequência de ${streak.current} dias`}>
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M12 3c2 3 5 4.5 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3 1-5.5 1-7.5z" fill="currentColor" /></svg>
              {streak.current} {streak.current === 1 ? "dia" : "dias"}
            </span>
          ) : null}
        </span>
        {level.nextLevel ? (
          <span className={styles.heroNext}>Faltam <strong>{pts(level.pointsToNext)}</strong> para {level.nextLevel.name}</span>
        ) : <span className={styles.heroNext}>Você chegou ao nível máximo.</span>}
      </div>
    </section>
  );
}

function MissionCard({ mission, index }: { mission: JourneyMissionCard; index: number }) {
  const reduce = useReducedMotionConfig();
  const { progress } = mission;
  const done = progress.completed;
  const muted = !progress.eligible && !done;
  return (
    <li className={styles.mission} data-state={done ? "done" : muted ? "muted" : "open"} data-kind={mission.kind}>
      <span className={styles.missionIcon} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={done ? "M5 12l4 4 10-10" : METRIC_ICON[mission.metric] ?? DEFAULT_ICON} /></svg>
      </span>
      <div className={styles.missionBody}>
        <div className={styles.missionTop}>
          <strong>{mission.title}</strong>
          <span className={styles.bonus} data-done={done}>{done ? `+${mission.bonusPoints} ganhos` : `+${mission.bonusPoints} pts`}</span>
        </div>
        {mission.kind === "campaign" ? <span className={styles.campaignTag}>Campanha</span> : mission.kind === "team" ? <span className={styles.campaignTag} data-team="true">Missão da equipe</span> : null}
        <span className={styles.missionDetail}>{muted ? "Sem plantão hoje: esta fica para o próximo." : mission.description}</span>
        <div className={styles.progressRow}>
          <span className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={progress.target} aria-valuenow={progress.progress} aria-label={mission.title}>
            <motion.i
              initial={{ width: reduce ? `${progress.percentage}%` : "0%" }}
              animate={{ width: `${progress.percentage}%` }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20, delay: 0.25 + index * 0.08 }}
            />
          </span>
          <span className={styles.progressText}>{done ? "Concluída" : `${progress.progress} de ${progress.target}`}</span>
        </div>
      </div>
    </li>
  );
}

const PodiumIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21V9h6v12M3 21v-7h6M15 21v-5h6v5M3 21h18M12 3l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 5.1l2-.3z" /></svg>
);

function UnitBoard({ board, optedOut }: { board: UnitLeaderboard | null; optedOut: boolean }) {
  if (!board || board.totalParticipants < 2) {
    return <EmptyState icon={<PodiumIcon />} title="O placar começa com os primeiros pontos" description="Assim que a unidade pontuar nesta semana, o pódio aparece aqui." />;
  }
  const self = board.self;
  const selfInTop = Boolean(self && self.position <= 3 && !self.optedOut);
  return (
    <div className={styles.board}>
      <Podium
        label="Pódio da semana"
        entries={board.topThree.map((broker) => ({ id: broker.brokerId, name: broker.name, imageUrl: broker.imageUrl, position: broker.position, value: pts(broker.points), highlight: self?.brokerId === broker.brokerId, highlightLabel: "Você" }))}
      />
      {self ? (
        <div className={styles.selfRow} data-top={selfInTop}>
          <span className={styles.selfPosition}>{self.position}º</span>
          <span className={styles.selfText}>
            <strong>{selfInTop ? "Você está no pódio" : `Você está em ${self.position}º de ${board.totalParticipants}`}</strong>
            <small>
              {board.gapToNext && self.position > 1 ? <>Faltam <b>{pts(board.gapToNext)}</b> para passar o {self.position - 1}º</> : self.position === 1 ? "Ninguém na frente. Segure a liderança." : "Continue pontuando para subir."}
            </small>
          </span>
          {self.positionChange ? <span className={styles.move} data-up={self.positionChange > 0}>{self.positionChange > 0 ? "▲" : "▼"} {Math.abs(self.positionChange)}</span> : null}
        </div>
      ) : null}
      {optedOut ? <p className={styles.quiet}>Você escolheu não aparecer para os outros. Só você vê a sua posição.</p> : null}
    </div>
  );
}

function AchievementGrid({ items }: { items: JourneyAchievement[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const visible = items.filter((item) => item.enabled || item.earned);
  const open = visible.find((item) => item.key === openKey) ?? null;
  return (
    <>
      <ul className={styles.badges}>
        {visible.map((item) => (
          <li key={item.key}>
            <button type="button" className={styles.badge} data-earned={item.earned} onClick={() => setOpenKey(item.key)} aria-label={`${item.name}: ${item.earned ? "conquistado" : `${item.current} de ${item.target}`}`}>
              <BadgeArt badge={item.key} earned={item.earned} percentage={item.percentage} size={60} />
              <span className={styles.badgeName}>{item.name}</span>
              <span className={styles.badgeProgress}>{item.earned ? "Conquistado" : `${Math.min(item.current, item.target)}/${item.target}`}</span>
            </button>
          </li>
        ))}
      </ul>
      <BottomSheet className="arc-venancor" open={Boolean(open)} onOpenChange={(value) => { if (!value) setOpenKey(null); }} title={open?.name ?? "Conquista"} detents={[0.5]} closeLabel="Fechar">
        {open ? (
          <div className={styles.badgeSheet}>
            <BadgeArt badge={open.key} earned={open.earned} percentage={open.percentage} size={112} />
            <p>{open.description}</p>
            {open.earned ? (
              <span className={styles.badgeWhen}>Conquistado em {open.earnedAt ? dayFormat.format(new Date(open.earnedAt)) : "breve"}</span>
            ) : (
              <div className={styles.badgeMeter}>
                <span className={styles.bar}><i style={{ width: `${open.percentage}%` }} /></span>
                <small>{Math.min(open.current, open.target)} de {open.target}. {open.target - open.current > 0 ? `Faltam ${open.target - open.current}.` : ""}</small>
              </div>
            )}
          </div>
        ) : null}
      </BottomSheet>
    </>
  );
}

function PointsLedger({ items }: { items: JourneyLedgerItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const groups = useMemo(() => {
    const map = new Map<string, JourneyLedgerItem[]>();
    for (const item of items) {
      const key = dayKey.format(new Date(item.occurredAt));
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [items]);
  if (!items.length) return <p className={styles.quiet}>Os pontos aparecem aqui assim que você atender.</p>;
  const shown = expanded ? groups : groups.slice(0, 2);
  return (
    <div className={styles.ledger}>
      {shown.map(([key, rows]) => {
        const total = rows.filter((row) => !row.reversed).reduce((sum, row) => sum + row.points, 0);
        return (
          <div key={key} className={styles.ledgerDay}>
            <div className={styles.ledgerDayHead}><span>{dayFormat.format(new Date(rows[0]!.occurredAt))}</span><strong>+{total}</strong></div>
            <ul>
              {rows.map((row) => (
                <li key={row.id} data-reversed={row.reversed}>
                  <span className={styles.ledgerText}><span>{row.label}</span>{row.detail ? <small>{row.detail}</small> : null}</span>
                  <time>{timeFormat.format(new Date(row.occurredAt))}</time>
                  <span className={styles.ledgerPoints}>{row.reversed ? "estornado" : `+${row.points}`}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {groups.length > 2 ? <button type="button" className={styles.more} onClick={() => setExpanded((value) => !value)}>{expanded ? "Mostrar menos" : "Ver dias anteriores"}</button> : null}
    </div>
  );
}
