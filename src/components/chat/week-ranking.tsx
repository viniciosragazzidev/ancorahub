"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import BottomSheet from "@/components/arc/bottom-sheet/bottom-sheet";
import type { MissionProgress } from "@/features/engagement/journey-types";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import { useFirstTimeToday } from "@/components/motion/first-time-today/use-first-time-today";

import css from "./week-ranking.module.css";

export type WeekRank = { key: string; position: number; label: string; total: number };
export type WeekStat = { label: string; value: string };

/** The broker's own standing and the "register a step" mission (journey flag on). */
export type HomeHighlights = {
  ranks: WeekRank[];
  /** Median time to accept the offers of the week ("1 min 20 s"). */
  acceptTime: string | null;
  mission: { title: string; detail: string; href: string; progress?: MissionProgress } | null;
  /** The numbers of the week shown in the sheet. */
  stats?: WeekStat[];
  /** One concrete way to climb, from the weakest number. */
  tip?: string | null;
  /** Atalho para a Jornada no fim do painel; só vem com a chave da Jornada ligada. */
  journeyHref?: string | null;
};

const ease = [0.16, 1, 0.3, 1] as const;
/** Share of the team the broker is ahead of (1st of 10 = 90%). */
const aheadOf = (rank: WeekRank) => (rank.total > 1 ? Math.round(((rank.total - rank.position) / (rank.total - 1)) * 100) : 100);
const medal = (position: number) => (position === 1 ? "🥇" : position === 2 ? "🥈" : position === 3 ? "🥉" : null);

/**
 * "Sua semana" on the Início: the best position at a glance; a tap opens the
 * sheet with every position, the numbers of the week and how to climb.
 * Only the broker's own position is shown (never the list of others).
 */
export function WeekRanking({ data, className }: { data: HomeHighlights; className?: string }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const best = [...data.ranks].sort((a, b) => a.position / a.total - b.position / b.total)[0] ?? null;

  return (
    <div className={`${css.root} ${className ?? ""}`} data-tour="home-highlights">
      <motion.button
        type="button"
        className={css.card}
        onClick={() => setOpen(true)}
        whileHover={reduce ? undefined : { y: -2 }}
        whileTap={reduce ? undefined : { scale: 0.98 }}
        aria-label="Ver sua semana: posições e números"
      >
        <span className={css.cardBadge} aria-hidden>{best ? medal(best.position) ?? "🏆" : "🏁"}</span>
        <span className={css.cardText}>
          <span className={css.cardTitle}>{best ? `${best.position}º ${best.label}` : "Sua semana"}</span>
          <span className={css.cardDetail}>
            {best
              ? data.ranks.length > 1 ? `E mais ${data.ranks.length - 1} ${data.ranks.length - 1 === 1 ? "posição" : "posições"}. Toque para ver.` : "Toque para ver seus números."
              : "Seu ranking aparece depois dos primeiros atendimentos da semana."}
          </span>
        </span>
        <svg viewBox="0 0 16 16" aria-hidden className={css.chevron}><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </motion.button>

      {data.mission ? (
        <Link href={data.mission.href} className={css.mission}>
          <span className={css.missionBadge}>Missão</span>
          <span className={css.cardText}>
            <span className={css.missionTitle}>{data.mission.title}</span>
            <span className={css.cardDetail}>{data.mission.detail}</span>
            {data.mission.progress ? <MissionBar progress={data.mission.progress} /> : null}
          </span>
          <svg viewBox="0 0 16 16" aria-hidden className={css.chevron}><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
      ) : null}

      <BottomSheet open={open} onOpenChange={setOpen} title="Sua semana" description="Últimos 7 dias. Só você vê a sua posição." detents={[0.72, 0.94]} closeLabel="Fechar" className="arc-venancor">
        <WeekSheet data={data} best={best} onNavigate={() => setOpen(false)} />
      </BottomSheet>
    </div>
  );
}

/** Atraso do stagger na primeira vez do dia: nunca passa de 120ms (motion-frequencia.md). */
const delayFor = (index: number) => Math.min(motionTokens.duration.instant, index * motionTokens.stagger.item);

/**
 * Conteúdo da folha "Sua semana". Monta a cada abertura da folha; anima só na
 * primeira abertura do dia, depois aparece já no estado final.
 */
function WeekSheet({ data, best, onNavigate }: { data: HomeHighlights; best: WeekRank | null; onNavigate: () => void }) {
  const animate = useFirstTimeToday("ranking-semana", useInterfaceMotionEnabled());
  return (
    <div className={css.sheet}>
      {best ? (
        <motion.div key={animate ? "hero-primeira-vez" : "hero"} className={css.hero} initial={animate ? { opacity: 0, scale: 0.96 } : false} animate={{ opacity: 1, scale: 1 }} transition={animate ? { duration: motionTokens.duration.standard, ease } : { duration: 0 }}>
          <span className={css.heroMedal} aria-hidden>{medal(best.position) ?? "🏆"}</span>
          <span className={css.heroPosition}>{best.position}º</span>
          <span className={css.heroLabel}>{best.label}</span>
          <span className={css.heroDetail}>À frente de {aheadOf(best)}% da equipe</span>
        </motion.div>
      ) : (
        <div className={css.hero}>
          <span className={css.heroMedal} aria-hidden>🏁</span>
          <span className={css.heroLabel}>Sua semana começa agora</span>
          <span className={css.heroDetail}>Aceite e inicie atendimentos para entrar no ranking.</span>
        </div>
      )}

      {data.ranks.length ? (
        <ul className={css.ranks} aria-label="Suas posições">
          {data.ranks.map((rank, index) => (
            <motion.li key={`${rank.key}:${animate ? "primeira-vez" : "estatico"}`} className={css.rank} initial={animate ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} transition={animate ? { duration: motionTokens.duration.standard, ease, delay: delayFor(index) } : { duration: 0 }}>
              <div className={css.rankHead}>
                <span className={css.rankLabel}>{rank.label.replace(/^n[oa]s? /, "").replace(/^\w/, (letter) => letter.toUpperCase())}</span>
                <span className={`${css.rankPosition} ${rank.position <= 3 ? css.rankTop : ""}`}>{rank.position}º de {rank.total}</span>
              </div>
              <span className={css.track} aria-hidden>
                <motion.span className={css.fill} data-animate={animate ? "primeira-vez" : undefined} initial={animate ? { scaleX: 0 } : false} animate={{ scaleX: Math.max(0.04, aheadOf(rank) / 100) }} transition={animate ? { duration: motionTokens.duration.considered, ease, delay: delayFor(index) } : { duration: 0 }} />
              </span>
            </motion.li>
          ))}
        </ul>
      ) : null}

      {data.stats?.length ? (
        <dl className={css.stats}>
          {data.stats.map((stat, index) => (
            <motion.div key={`${stat.label}:${animate ? "primeira-vez" : "estatico"}`} className={css.stat} initial={animate ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={animate ? { duration: motionTokens.duration.standard, ease, delay: delayFor(index) } : { duration: 0 }}>
              <dt className={css.statLabel}>{stat.label}</dt>
              <dd className={css.statValue}>{stat.value}</dd>
            </motion.div>
          ))}
        </dl>
      ) : null}

      {data.tip ? (
        <p className={css.tip}><strong>Como subir:</strong> {data.tip}</p>
      ) : null}

      {data.mission ? (
        <Link href={data.mission.href} className={css.mission} onClick={onNavigate}>
          <span className={css.missionBadge}>Missão</span>
          <span className={css.cardText}>
            <span className={css.missionTitle}>{data.mission.title}</span>
            <span className={css.cardDetail}>{data.mission.detail}</span>
            {data.mission.progress ? <MissionBar progress={data.mission.progress} /> : null}
          </span>
        </Link>
      ) : null}

      {data.journeyHref ? (
        <Link href={data.journeyHref} className={css.journeyLink} onClick={onNavigate}>
          Ver minha jornada
          <svg viewBox="0 0 16 16" aria-hidden className={css.journeyArrow}><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
      ) : null}
    </div>
  );
}

function MissionBar({ progress }: { progress: MissionProgress }) {
  // Fica no Início (dezenas de visitas por dia): enche só na primeira montagem do dia.
  const reduce = !useFirstTimeToday("missao-etapas", useInterfaceMotionEnabled());
  return <span className={css.track} role="progressbar" aria-label="Etapas registradas" aria-valuemin={0} aria-valuemax={progress.target} aria-valuenow={Math.min(progress.progress, progress.target)} aria-valuetext={`${progress.progress} de ${progress.target} leads com etapa`}>
    <motion.span key={reduce ? "estatico" : "primeira-vez"} className={css.fill} initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: progress.percentage / 100 }} transition={reduce ? { duration: 0 } : motionTokens.spring.snappy} />
  </span>;
}
