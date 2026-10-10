"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import BottomSheet from "@/components/arc/bottom-sheet/bottom-sheet";

import css from "./week-ranking.module.css";

export type WeekRank = { key: string; position: number; label: string; total: number };
export type WeekStat = { label: string; value: string };

/** The broker's own standing and the "register a step" mission (journey flag on). */
export type HomeHighlights = {
  ranks: WeekRank[];
  /** Median time to accept the offers of the week ("1 min 20 s"). */
  acceptTime: string | null;
  mission: { title: string; detail: string; href: string } | null;
  /** The numbers of the week shown in the sheet. */
  stats?: WeekStat[];
  /** One concrete way to climb, from the weakest number. */
  tip?: string | null;
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
          </span>
          <svg viewBox="0 0 16 16" aria-hidden className={css.chevron}><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
      ) : null}

      <BottomSheet open={open} onOpenChange={setOpen} title="Sua semana" description="Últimos 7 dias. Só você vê a sua posição." detents={[0.72, 0.94]} closeLabel="Fechar" className="arc-venancor">
        <div className={css.sheet}>
          {best ? (
            <motion.div className={css.hero} initial={reduce ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, ease }}>
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
                <motion.li key={rank.key} className={css.rank} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease, delay: reduce ? 0 : 0.15 + index * 0.06 }}>
                  <div className={css.rankHead}>
                    <span className={css.rankLabel}>{rank.label.replace(/^n[oa]s? /, "").replace(/^\w/, (letter) => letter.toUpperCase())}</span>
                    <span className={`${css.rankPosition} ${rank.position <= 3 ? css.rankTop : ""}`}>{rank.position}º de {rank.total}</span>
                  </div>
                  <span className={css.track} aria-hidden>
                    <motion.span className={css.fill} initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: Math.max(0.04, aheadOf(rank) / 100) }} transition={{ duration: 0.7, ease, delay: reduce ? 0 : 0.25 + index * 0.06 }} />
                  </span>
                </motion.li>
              ))}
            </ul>
          ) : null}

          {data.stats?.length ? (
            <dl className={css.stats}>
              {data.stats.map((stat, index) => (
                <motion.div key={stat.label} className={css.stat} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: reduce ? 0 : 0.3 + index * 0.04 }}>
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
            <Link href={data.mission.href} className={css.mission} onClick={() => setOpen(false)}>
              <span className={css.missionBadge}>Missão</span>
              <span className={css.cardText}>
                <span className={css.missionTitle}>{data.mission.title}</span>
                <span className={css.cardDetail}>{data.mission.detail}</span>
              </span>
            </Link>
          ) : null}
        </div>
      </BottomSheet>
    </div>
  );
}
