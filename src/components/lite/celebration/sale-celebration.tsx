"use client";

/**
 * Celebração da venda registrada (nível 3, docs/design-system/FEEDBACK.md §3), no estilo das telas de
 * conquista do Duolingo: tela cheia e limpa, o capitão grande no centro com brilhos que piscam em volta,
 * título curto, uma frase, até três números em cartões e um único botão "Continuar".
 * Só abre depois que a venda foi persistida. Nunca mostra dado pessoal do cliente.
 */
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import { prefersLessMotion } from "@/features/assist/a11y-prefs";
import { fireFeedbackOnce } from "@/lib/feedback/use-feedback";

import styles from "./sale-celebration.module.css";

export type SaleCelebrationStat = { label: string; value: string };

export interface SaleCelebrationProps {
  open: boolean;
  onClose: () => void;
  /** Muda a cada venda; o som e a vibração tocam uma vez por chave. */
  celebrationKey: string;
  title?: string;
  message?: string;
  /** Até três números (ex.: valor mensal, vidas, vendas no mês). Sem dado pessoal do cliente. */
  stats?: SaleCelebrationStat[];
  continueLabel?: string;
}

const ART = { src: "/mascote/venda-capitao.webp", width: 584, height: 640 };

/** Brilhos em volta do capitão: posição (% da área), tamanho em px e atraso do piscar. */
const SPARKLES: Array<{ x: number; y: number; size: number; delay: number }> = [
  { x: 6, y: 22, size: 14, delay: 0.1 },
  { x: 14, y: 58, size: 10, delay: 0.55 },
  { x: 88, y: 14, size: 12, delay: 0.3 },
  { x: 94, y: 52, size: 16, delay: 0.8 },
  { x: 80, y: 86, size: 10, delay: 0.45 },
  { x: 22, y: 90, size: 12, delay: 0.95 },
];

type Bezier = [number, number, number, number];
const easeEnter: Bezier = [...motionTokens.ease.enter];

function Sparkle({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0c.9 6.6 4.5 10.6 12 12-7.5 1.4-11.1 5.4-12 12-.9-6.6-4.5-10.6-12-12C7.5 10.6 11.1 6.6 12 0Z" fill="currentColor" />
    </svg>
  );
}

export function SaleCelebration({ open, onClose, celebrationKey, title = "Venda registrada!", message = "Mais uma família protegida. Bom trabalho.", stats = [], continueLabel = "Continuar" }: SaleCelebrationProps) {
  const interfaceMotion = useInterfaceMotionEnabled();
  const motionOn = interfaceMotion && !prefersLessMotion();
  const titleId = useId();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    fireFeedbackOnce(`sale-celebration:${celebrationKey}`, "celebrate", { budgetKey: "venda" }, motionOn);
    const focus = window.setTimeout(() => button.current?.focus({ preventScroll: true }), 50);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(focus); window.removeEventListener("keydown", onKey); };
  }, [open, celebrationKey, motionOn, onClose]);

  if (typeof document === "undefined") return null;

  // Ritmo: o capitão entra e assenta; título, frase, números e botão chegam em seguida (beat do padrão).
  const at = (seconds: number) => (motionOn ? seconds : 0);
  const rise = (delay: number) => ({
    initial: motionOn ? { opacity: 0, y: motionTokens.distance.md } : { opacity: 0 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: motionOn ? motionTokens.duration.standard : motionTokens.duration.instant, ease: easeEnter, delay: at(delay) },
  });

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="sale-celebration"
          className={`arc-venancor ${styles.screen}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-sale-celebration=""
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
          transition={{ duration: motionOn ? motionTokens.duration.fast : 0 }}
        >
          <div className={styles.column}>
            <div className={styles.stage}>
              {motionOn
                ? SPARKLES.map((sparkle, index) => (
                    <motion.span
                      key={index}
                      className={styles.sparkle}
                      style={{ left: `${sparkle.x}%`, top: `${sparkle.y}%` }}
                      initial={{ opacity: 0, scale: 0.3 }}
                      animate={{ opacity: [0, 1, 0], scale: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.4, delay: 0.35 + sparkle.delay, repeat: 2, repeatDelay: 0.4, ease: "easeInOut" }}
                    >
                      <Sparkle size={sparkle.size} />
                    </motion.span>
                  ))
                : null}
              <motion.img
                className={styles.hero}
                src={ART.src}
                width={ART.width}
                height={ART.height}
                alt=""
                draggable={false}
                initial={motionOn ? { opacity: 0, scale: 0.6, y: 24 } : false}
                animate={motionOn ? { opacity: 1, scale: [0.6, 1.06, 1], y: [24, -12, 0] } : { opacity: 1, scale: 1, y: 0 }}
                transition={motionOn ? { duration: 0.62, times: [0, 0.6, 1], ease: easeEnter, opacity: { duration: motionTokens.duration.fast } } : { duration: 0 }}
              />
            </div>

            <motion.h2 id={titleId} className={styles.title} {...rise(0.36)}>{title}</motion.h2>
            <motion.p className={styles.message} {...rise(0.44)}>{message}</motion.p>

            {stats.length ? (
              <ul className={styles.stats} aria-label="Resumo da venda">
                {stats.slice(0, 3).map((stat, index) => (
                  <motion.li key={stat.label} className={styles.stat} {...rise(0.52 + index * motionTokens.beat.text)}>
                    <span className={styles.statLabel}>{stat.label}</span>
                    <span className={styles.statValue}>{stat.value}</span>
                  </motion.li>
                ))}
              </ul>
            ) : null}

            <motion.div className={styles.actions} {...rise(0.72)}>
              <button ref={button} type="button" className={styles.continue} onClick={onClose}>{continueLabel}</button>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
