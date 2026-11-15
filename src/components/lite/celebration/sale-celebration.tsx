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
  /** Outra conquista (15/11/2026): presença no plantão, WhatsApp conectado. Padrão: o capitão com o baú. */
  art?: { src: string; width: number; height: number };
  /** Selo que pula no canto do capitão. */
  badge?: "check" | "whatsapp";
  /** Chave do limite diário da celebração (padrão "venda"). */
  budgetKey?: string;
  /** false quando quem abriu já tocou o som e a vibração (fila de conquistas). */
  feedback?: boolean;
  /** Rótulo dos números para leitores de tela. */
  statsLabel?: string;
}

const ART = { src: "/mascote/venda-capitao.webp", width: 584, height: 640 };

/** Confete curto (só nível 3 do Lite): cor, deslocamento e giro de cada pedaço. */
const CONFETTI = [
  { color: "oklch(84% 0.16 85)", x: -120, y: -150, r: 200 }, { color: "var(--success)", x: 110, y: -170, r: -160 },
  { color: "var(--chat-action)", x: -160, y: -40, r: 120 }, { color: "oklch(70% 0.17 28)", x: 150, y: -60, r: -220 },
  { color: "oklch(84% 0.16 85)", x: -70, y: -200, r: 260 }, { color: "var(--chat-action)", x: 70, y: -210, r: -140 },
  { color: "var(--success)", x: -150, y: 40, r: 180 }, { color: "oklch(84% 0.16 85)", x: 160, y: 30, r: -200 },
  { color: "oklch(70% 0.17 28)", x: -30, y: -230, r: 140 }, { color: "var(--success)", x: 30, y: -180, r: -240 },
  { color: "var(--chat-action)", x: -190, y: -110, r: 220 }, { color: "oklch(84% 0.16 85)", x: 190, y: -120, r: -180 },
];

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
      <path fill="currentColor" d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.7l5-1.3A9.7 9.7 0 1 0 12 2.2Zm0 17.7c-1.5 0-2.9-.4-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3c-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.3Z" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

export function SaleCelebration({ open, onClose, celebrationKey, title = "Venda registrada!", message = "Mais uma família protegida. Bom trabalho.", stats = [], continueLabel = "Continuar", art = ART, badge, budgetKey = "venda", feedback = true, statsLabel = "Resumo da venda" }: SaleCelebrationProps) {
  const interfaceMotion = useInterfaceMotionEnabled();
  const motionOn = interfaceMotion && !prefersLessMotion();
  const titleId = useId();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    if (feedback) fireFeedbackOnce(`sale-celebration:${celebrationKey}`, "celebrate", { budgetKey }, motionOn);
    const focus = window.setTimeout(() => button.current?.focus({ preventScroll: true }), 50);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(focus); window.removeEventListener("keydown", onKey); };
  }, [open, celebrationKey, motionOn, onClose, feedback, budgetKey]);

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
              {motionOn ? (
                <motion.span className={styles.burst} aria-hidden="true"
                  initial={{ opacity: 0, scale: 0.4, rotate: 0 }}
                  animate={{ opacity: [0, 1, 0.75], scale: [0.4, 1.08, 1], rotate: 40 }}
                  transition={{ duration: 1.6, ease: easeEnter, rotate: { duration: 6, ease: "linear" } }} />
              ) : null}
              {motionOn
                ? CONFETTI.map((piece, index) => (
                    <motion.span key={`c${index}`} className={styles.confetti} style={{ background: piece.color }} aria-hidden="true"
                      initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.6 }}
                      animate={{ opacity: [0, 1, 1, 0], x: [0, piece.x, piece.x * 1.15], y: [0, piece.y, piece.y + 220], rotate: piece.r * 2, scale: 1 }}
                      transition={{ duration: 1.9, delay: 0.5 + (index % 4) * 0.04, ease: [0.2, 0.7, 0.3, 1], times: [0, 0.12, 0.7, 1] }} />
                  ))
                : null}
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
                src={art.src}
                width={art.width}
                height={art.height}
                alt=""
                draggable={false}
                initial={motionOn ? { opacity: 0, scale: 0.6, y: 24 } : false}
                animate={motionOn ? { opacity: 1, scale: [0.6, 1.06, 1], y: [24, -12, 0] } : { opacity: 1, scale: 1, y: 0 }}
                transition={motionOn ? { duration: 0.62, times: [0, 0.6, 1], ease: easeEnter, opacity: { duration: motionTokens.duration.fast } } : { duration: 0 }}
              />
              {badge ? (
                <motion.span className={styles.badge} data-badge={badge} aria-hidden="true"
                  initial={motionOn ? { opacity: 0, scale: 0, rotate: -30 } : false}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={motionOn ? { type: "spring", visualDuration: 0.45, bounce: 0.55, delay: 0.5 } : { duration: 0 }}>
                  {badge === "whatsapp" ? <WhatsAppGlyph /> : <CheckGlyph />}
                </motion.span>
              ) : null}
            </div>

            <motion.h2 id={titleId} className={styles.title} {...rise(0.36)}>{title}</motion.h2>
            <motion.p className={styles.message} {...rise(0.44)}>{message}</motion.p>

            {stats.length ? (
              <ul className={styles.stats} aria-label={statsLabel}>
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

/** Números da celebração a partir do formulário da venda: valor mensal e vigência. Sem dado pessoal. */
export function saleCelebrationStats({ approvedValue, contractTermMonths }: { approvedValue?: string | number | null; contractTermMonths?: number | null }): SaleCelebrationStat[] {
  const stats: SaleCelebrationStat[] = [];
  const raw = typeof approvedValue === "number" ? approvedValue : Number(String(approvedValue ?? "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  if (Number.isFinite(raw) && raw > 0) stats.push({ label: "Valor mensal", value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(raw) });
  if (contractTermMonths && contractTermMonths > 0) stats.push({ label: "Vigência", value: `${contractTermMonths} meses` });
  return stats;
}
