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

export function CaptainBanner({ label, title, goal, progress, action, art = CAPTAIN_TREASURE_ART, tone = "navy", pose = "rise", className }: {
  /** Nome acessível da região. */
  label: string;
  title: ReactNode;
  /** Selo dourado: o número que importa e um complemento curto. */
  goal?: { value: ReactNode; hint?: ReactNode };
  /** 0 a 100: barra dourada sob o selo. */
  progress?: number | null;
  action: { label: string; href: string };
  art?: CaptainBannerArt;
  /** navy: o azul da marca (Início, jornada). light: azul bem claro com texto azul-marinho (Plantões). */
  tone?: "navy" | "light";
  /** rise: o capitão sai pelo topo do card. peek: ele espia por cima da borda de baixo, debruçado. */
  pose?: "rise" | "peek";
  className?: string;
}) {
  const share = progress === null || progress === undefined ? null : Math.min(100, Math.max(0, Math.round(progress)));
  return (
    <section className={[styles.banner, className].filter(Boolean).join(" ")} data-tone={tone} data-pose={pose} aria-label={label}>
      <span className={styles.glow} aria-hidden="true" />
      <p className={styles.title}>{title}</p>
      {goal || share !== null ? (
        <div className={styles.goal}>
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
        </div>
      ) : null}
      <Link className={styles.action} href={action.href}>{action.label}</Link>
      {/* eslint-disable-next-line @next/next/no-img-element -- arte local do mascote */}
      <img className={styles.art} src={art.src} width={art.width} height={art.height} alt="" aria-hidden="true" draggable={false} />
    </section>
  );
}
