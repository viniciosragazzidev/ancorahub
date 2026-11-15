/**
 * Banner com o capitão (14/11/2026, no estilo do card promocional do Duolingo): uma frase com a próxima meta,
 * um selo dourado com o número que importa, uma barra opcional e um botão branco com base. O capitão sai pelo
 * topo do card, à direita. Usado no fim da Minha jornada e no fim do Início. Uma ação por banner.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./captain-banner.module.css";

export type CaptainBannerArt = { src: string; width: number; height: number };

/** Arte provisória (o capitão com o baú) até as artes próprias de cada banner chegarem. */
export const CAPTAIN_TREASURE_ART: CaptainBannerArt = { src: "/mascote/venda-capitao.webp", width: 584, height: 640 };

export function CaptainBanner({ label, title, subtitle, facts, goal, progress, action, actionSlot, art = CAPTAIN_TREASURE_ART, tone = "navy", pose = "rise", size = "regular", className }: {
  /** Nome acessível da região. */
  label: string;
  title: ReactNode;
  /** Uma frase sob o título (Início: o próximo passo do dia). */
  subtitle?: ReactNode;
  /** Fatos curtos em chips (Início: plantão, meta, semana). */
  facts?: { label: string; value: ReactNode }[];
  /** Selo dourado: o número que importa e um complemento curto. */
  goal?: { value: ReactNode; hint?: ReactNode };
  /** 0 a 100: barra dourada sob o selo. */
  progress?: number | null;
  /** Sem ação e sem actionSlot o banner fica sem botão (aviso do Início sem link). */
  action?: { label: string; href: string };
  /** Troca o link do botão por outro controle com o mesmo desenho (Início: o aceite da oferta). */
  actionSlot?: (className: string) => ReactNode;
  art?: CaptainBannerArt;
  /** navy: o azul da marca (Início, jornada). light: azul bem claro com texto azul-marinho (Plantões). */
  /** white: quase branco, com borda e um brilho quente (Desempenho). */
  tone?: "navy" | "light" | "white";
  /** rise: o capitão sai pelo topo do card. peek: ele espia por cima da borda de baixo, debruçado. */
  pose?: "rise" | "peek";
  /** compact: mais baixo, para entrar entre dois cards como um respiro de cor (Plantões). */
  size?: "regular" | "compact";
  className?: string;
}) {
  const share = progress === null || progress === undefined ? null : Math.min(100, Math.max(0, Math.round(progress)));
  const shownFacts = facts?.length ? facts : null;
  return (
    <section className={[styles.banner, className].filter(Boolean).join(" ")} data-tone={tone} data-pose={pose} data-size={size} data-goal={goal || share !== null ? "" : undefined} data-rich={subtitle || shownFacts ? "" : undefined} aria-label={label}>
      <span className={styles.glow} aria-hidden="true" />
      {subtitle ? (
        <div className={styles.head}>
          <p className={styles.title}>{title}</p>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
      ) : <p className={styles.title}>{title}</p>}
      {goal || share !== null || shownFacts ? (
        <div className={styles.goal} data-facts={shownFacts ? "" : undefined}>
          {goal ? (
            <span className={styles.badge}>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 2l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 16.9 6.1 20l1.2-6.5L2.5 8.9 9.1 8z" fill="currentColor" /></svg>
              {goal.value}
              {goal.hint ? <small>{goal.hint}</small> : null}
            </span>
          ) : null}
          {share !== null ? (
            <span className={styles.meter} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={share} aria-label="Progresso até a meta">
              <i style={{ width: `${share}%` }} />
            </span>
          ) : null}
          {shownFacts ? (
            <ul className={styles.facts}>
              {shownFacts.map((fact) => (
                <li key={fact.label} className={styles.fact}><span>{fact.label}</span><strong>{fact.value}</strong></li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {actionSlot ? actionSlot(styles.action) : action ? <Link className={styles.action} href={action.href} target={action.href.startsWith("http") ? "_blank" : undefined} rel={action.href.startsWith("http") ? "noreferrer" : undefined}>{action.label}</Link> : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- arte local do mascote */}
      <img className={styles.art} src={art.src} width={art.width} height={art.height} alt="" aria-hidden="true" draggable={false} />
    </section>
  );
}
