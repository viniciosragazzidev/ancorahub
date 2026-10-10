"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { AssistantAvatar } from "../assistant-avatar";
import { DynamicNotice, type DynamicNoticeItem } from "../dynamic-notice";
import styles from "./lite-tour.module.css";
import { availableSteps, narrationSrc, TOUR_STEPS, TOUR_STORAGE_KEY, totalXp, type TourStep } from "./tour-steps";

export const START_TOUR_EVENT = "ancora:start-lite-tour";
const MUTE_KEY = "ancora:lite-tour:muted";
const PAD = 8;
const CARD_GAP = 14;
const EASE = [0.16, 1, 0.3, 1] as const;
/** 0.1s of silence: played inside the starting tap so iOS lets this element play later. */
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

/** Opens the tour from anywhere (welcome card, "Mais" menu). */
export function startLiteTour() {
  window.dispatchEvent(new Event(START_TOUR_EVENT));
}

export function hasSeenLiteTour() {
  try { return window.localStorage.getItem(TOUR_STORAGE_KEY) === "done"; } catch { return true; }
}

type Rect = { x: number; y: number; width: number; height: number; radius: number };

function targetElement(target?: string) {
  return target ? document.querySelector<HTMLElement>(`[data-tour="${target}"]`) : null;
}

function isVisible(element: HTMLElement | null) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function measure(element: HTMLElement): Rect {
  const rect = element.getBoundingClientRect();
  const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 16;
  return { x: rect.left - PAD, y: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, radius: Math.min(radius + PAD, 28) };
}

const DEMO_CHOICES = [
  { id: "accept", label: "Aceitar e chamar no WhatsApp", correct: true, feedback: "Isso! Lead novo esfria rápido: quem responde nos primeiros minutos fecha muito mais." },
  { id: "wait", label: "Esperar ela mandar mensagem", correct: false, feedback: "Quase. Esperar faz o lead esfriar: o melhor é aceitar e chamar logo." },
  { id: "later", label: "Deixar para depois do almoço", correct: false, feedback: "Hmm, o prazo do primeiro contato corre. Aceitar e chamar agora é o caminho." },
] as const;

const NOTICE_DEMO: DynamicNoticeItem = {
  id: "tour-demo",
  app: "Leads",
  title: "Novo lead: Maria Souza",
  message: "PME, 3 vidas, campanha Outubro",
  actionLabel: "Atender",
  shape: "mochi",
  hue: 212,
  pillLabel: "Lead novo",
};

/**
 * Guided tour of the broker app: dark backdrop, an animated spotlight on the
 * area being explained, an elegant card with the step, XP per step, a small
 * challenge, the new-lead notice preview and a finale with a badge. Each step
 * plays /onboarding/narracao/{id}.mp3 when the file exists (mute toggle).
 */
export function LiteTour() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [xp, setXp] = useState(0);
  const [gain, setGain] = useState<{ key: number; value: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [muted, setMuted] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const earned = useRef(new Set<string>());
  const primaryRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const step = open ? steps[index] : undefined;

  /** Creates and unlocks the single narration element; call it inside a tap (iOS plays only after a gesture). */
  const ensureAudio = useCallback(() => {
    if (audioRef.current || typeof Audio === "undefined") return;
    const audio = new Audio(SILENCE);
    audio.volume = 0.95;
    void audio.play().catch(() => undefined);
    audioRef.current = audio;
  }, []);

  const start = useCallback(() => {
    // Usually runs inside the tap that opened the tour; from ?tour=1 the first tour button unlocks it instead.
    ensureAudio();
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const list = availableSteps(TOUR_STEPS, (target) => isVisible(targetElement(target)));
    earned.current = new Set();
    try { setMuted(window.localStorage.getItem(MUTE_KEY) === "1"); } catch { /* ignore */ }
    setSteps(list);
    setIndex(0);
    setXp(0);
    setAnswer(null);
    setOpen(true);
  }, [ensureAudio]);

  // Start from the event (welcome card, menu) or from ?tour=1.
  useEffect(() => {
    const onStart = () => start();
    window.addEventListener(START_TOUR_EVENT, onStart);
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") === "1") {
      params.delete("tour");
      const query = params.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
      const timer = window.setTimeout(start, 400);
      return () => { window.removeEventListener(START_TOUR_EVENT, onStart); window.clearTimeout(timer); };
    }
    return () => window.removeEventListener(START_TOUR_EVENT, onStart);
  }, [start]);

  // Follow the target: scroll it into view, then track its box while the step is open.
  useEffect(() => {
    if (!open) return;
    const element = step?.kind === "spotlight" ? targetElement(step.target) : null;
    element?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    let frame = 0;
    let stable = 0;
    let last = "";
    const tick = () => {
      setViewport((current) => (current.width === window.innerWidth && current.height === window.innerHeight ? current : { width: window.innerWidth, height: window.innerHeight }));
      const next = element ? measure(element) : null;
      const key = next ? `${Math.round(next.x)}:${Math.round(next.y)}:${Math.round(next.width)}:${Math.round(next.height)}` : "none";
      stable = key === last ? stable + 1 : 0;
      last = key;
      setRect((current) => (current && next && `${Math.round(current.x)}:${Math.round(current.y)}:${Math.round(current.width)}:${Math.round(current.height)}` === key ? current : next));
      // Stop once the box held still for ~0.5s (smooth scroll done); scroll/resize wake it up.
      frame = stable < 30 ? window.requestAnimationFrame(tick) : 0;
    };
    const wake = () => { if (!frame) { stable = 0; frame = window.requestAnimationFrame(tick); } };
    tick();
    window.addEventListener("resize", wake);
    window.addEventListener("scroll", wake, true);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", wake);
      window.removeEventListener("scroll", wake, true);
    };
  }, [open, step, reduce]);

  // Narration of the step on the unlocked element (silently skipped when the file does not exist yet).
  useEffect(() => {
    const audio = audioRef.current;
    if (!open || !step || muted || !audio) return;
    audio.src = narrationSrc(step.id);
    void audio.play().catch(() => undefined);
    return () => { audio.pause(); };
  }, [open, step, muted]);

  // Focus the main action on each step (keyboard and screen readers follow the tour).
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => primaryRef.current?.focus({ preventScroll: true }), reduce ? 0 : 260);
    return () => window.clearTimeout(timer);
  }, [open, index, reduce]);

  const award = useCallback((id: string, value: number) => {
    if (earned.current.has(id)) return;
    earned.current.add(id);
    setXp((current) => current + value);
    setGain({ key: Date.now(), value });
  }, []);

  const close = useCallback((completed: boolean) => {
    try { window.localStorage.setItem(TOUR_STORAGE_KEY, completed ? "done" : "skipped"); } catch { /* ignore */ }
    audioRef.current?.pause();
    setOpen(false);
    setRect(null);
    const back = returnFocus.current;
    if (back?.isConnected) window.setTimeout(() => back.focus({ preventScroll: true }), 0);
  }, []);

  const next = useCallback(() => {
    if (!step) return;
    ensureAudio();
    if (step.kind === "demo-reply" && !answer) return;
    if (step.kind !== "demo-reply") award(step.id, step.xp);
    if (index >= steps.length - 1) { close(true); return; }
    setAnswer(null);
    setIndex((current) => current + 1);
  }, [answer, award, close, ensureAudio, index, step, steps.length]);

  const back = useCallback(() => {
    ensureAudio();
    setAnswer(null);
    setIndex((current) => Math.max(0, current - 1));
  }, [ensureAudio]);

  const choose = useCallback((choiceId: string) => {
    if (!step || answer) return;
    setAnswer(choiceId);
    const correct = DEMO_CHOICES.find((choice) => choice.id === choiceId)?.correct;
    award(step.id, correct ? step.xp : 10);
  }, [answer, award, step]);

  // Keyboard: arrows move, Enter continues, Esc leaves.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        // Focus trap: Tab cycles through the tour's own controls only.
        // A real new-lead notice above the tour stays reachable (its "Atender" joins the cycle).
        const selector = "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";
        const focusables = [
          ...Array.from(document.querySelectorAll<HTMLElement>(`[data-dynamic-notice] ${selector.split(", ").join(", [data-dynamic-notice] ")}`)),
          ...Array.from(rootRef.current?.querySelectorAll<HTMLElement>(selector) ?? []),
        ];
        if (!focusables.length) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        const active = document.activeElement;
        const inside = (node: Element | null) => Boolean(node && focusables.includes(node as HTMLElement));
        if (event.shiftKey && (active === first || !inside(active))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (active === last || !inside(active))) { event.preventDefault(); first.focus(); }
        return;
      }
      if (event.key === "Escape") { event.preventDefault(); close(false); }
      else if (event.key === "ArrowRight") { event.preventDefault(); next(); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); back(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, close, next, open]);

  const toggleMute = () => {
    ensureAudio();
    // Turning the sound back on plays the current step right away, inside this tap.
    if (muted && step && audioRef.current) {
      audioRef.current.src = narrationSrc(step.id);
      void audioRef.current.play().catch(() => undefined);
    }
    setMuted((current) => {
      try { window.localStorage.setItem(MUTE_KEY, current ? "0" : "1"); } catch { /* ignore */ }
      return !current;
    });
  };

  const maxXp = useMemo(() => totalXp(steps), [steps]);
  if (!open || !step || typeof document === "undefined") return null;

  const centered = step.kind !== "spotlight" || !rect;
  const cardWidth = Math.min(360, viewport.width - 24);
  let cardStyle: React.CSSProperties = {};
  if (!centered && rect) {
    const below = viewport.height - (rect.y + rect.height) > 250;
    const above = rect.y > 250;
    const left = Math.min(Math.max(12, rect.x + rect.width / 2 - cardWidth / 2), viewport.width - cardWidth - 12);
    cardStyle = below
      ? { top: rect.y + rect.height + CARD_GAP, left, width: cardWidth }
      : above
        ? { bottom: viewport.height - rect.y + CARD_GAP, left, width: cardWidth }
        : { bottom: 12, left, width: cardWidth };
  } else if (step.kind === "demo-notice") {
    cardStyle = { top: 150, left: (viewport.width - cardWidth) / 2, width: cardWidth };
  }

  const isLast = index === steps.length - 1;
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 300, damping: 32, mass: 0.9 };

  return createPortal(
    <div ref={rootRef} className={styles.root} data-tour-open="true">
      {/* Backdrop with the spotlight hole. */}
      <svg className={styles.backdrop} width="100%" height="100%" aria-hidden="true">
        <defs>
          <mask id="lite-tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {rect && step.kind === "spotlight" ? (
              <motion.rect
                initial={false}
                animate={{ x: rect.x, y: rect.y, width: rect.width, height: rect.height, rx: rect.radius }}
                transition={spring}
                fill="black"
              />
            ) : null}
          </mask>
        </defs>
        <motion.rect width="100%" height="100%" fill="oklch(14% .02 260 / .74)" mask="url(#lite-tour-hole)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.24 }} />
      </svg>

      {/* Glowing ring around the highlighted area. */}
      {rect && step.kind === "spotlight" ? (
        <motion.div
          className={styles.ring}
          initial={false}
          animate={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, borderRadius: rect.radius }}
          transition={spring}
          aria-hidden="true"
        />
      ) : null}

      {/* Top bar: progress, XP, sound, skip. */}
      <div className={styles.topbar}>
        <div className={styles.progress} aria-hidden="true">
          {steps.map((item, position) => (
            <span key={item.id} className={styles.segment} data-state={position < index ? "done" : position === index ? "current" : "todo"} />
          ))}
        </div>
        <div className={styles.topActions}>
          <span className={styles.xp} aria-live="polite">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.3l-3.8 2 .7-4.3-3.1-3 4.3-.6L8 1.5Z" fill="currentColor" /></svg>
            <motion.span key={xp} initial={reduce ? false : { scale: 1.35 }} animate={{ scale: 1 }} transition={{ type: "spring", visualDuration: 0.3, bounce: 0.4 }}>{xp}</motion.span> XP
          </span>
          <button type="button" className={styles.iconButton} onClick={toggleMute} aria-label={muted ? "Ligar narração" : "Silenciar narração"} aria-pressed={muted}>
            {muted
              ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6h2.5L9 3v10L5.5 10H3V6Z" fill="currentColor" /><path d="m11 6 3.5 4M14.5 6 11 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6h2.5L9 3v10L5.5 10H3V6Z" fill="currentColor" /><path d="M11.2 5.5a3.5 3.5 0 0 1 0 5M12.8 3.8a6 6 0 0 1 0 8.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>}
          </button>
          {!isLast ? <button type="button" className={styles.skip} onClick={() => close(false)}>Pular</button> : null}
        </div>
      </div>

      {/* +XP that floats up when a step is completed. */}
      <AnimatePresence>
        {gain && !reduce ? (
          <motion.span
            key={gain.key}
            className={styles.gain}
            initial={{ opacity: 0, y: 8, scale: 0.8 }}
            animate={{ opacity: 1, y: -18, scale: 1 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.5, ease: EASE }}
            onAnimationComplete={() => window.setTimeout(() => setGain(null), 350)}
          >
            +{gain.value} XP
          </motion.span>
        ) : null}
      </AnimatePresence>

      {/* The new-lead notice, live, for the notice step. */}
      {step.kind === "demo-notice" ? (
        <div className={styles.noticeStage}>
          <DynamicNotice item={NOTICE_DEMO} onOpen={() => undefined} onDismiss={() => undefined} />
        </div>
      ) : null}

      {step.kind === "finale" && !reduce ? <Confetti /> : null}

      <AnimatePresence mode="wait">
        <motion.section
          key={step.id}
          role="dialog"
          aria-modal="true"
          aria-labelledby="lite-tour-title"
          aria-describedby="lite-tour-body"
          className={`${styles.card} ${centered && step.kind !== "demo-notice" ? styles.cardCentered : ""} ${step.kind === "intro" || step.kind === "finale" ? styles.cardHero : ""}`}
          style={cardStyle}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.97, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98, filter: "blur(4px)", transition: { duration: 0.14 } }}
          transition={{ duration: 0.28, ease: EASE }}
        >
          {step.kind === "intro" ? <Team reduce={Boolean(reduce)} /> : null}
          {step.kind === "finale" ? <Badge xp={xp} maxXp={maxXp} reduce={Boolean(reduce)} /> : null}

          <div className={styles.cardHead}>
            {step.kind === "spotlight" || step.kind === "demo-reply" || step.kind === "demo-notice" ? (
              <AssistantAvatar shape={step.mascot.shape} hue={step.mascot.hue} size={36} state="working" />
            ) : null}
            <span className={styles.stepTag}>{step.kind === "intro" ? "Tour do app" : step.kind === "finale" ? "Concluído" : `Passo ${index} de ${steps.length - 2}`}</span>
          </div>
          <h2 id="lite-tour-title" className={styles.title}>{step.title}</h2>
          <p id="lite-tour-body" className={styles.body}>{step.body}</p>

          {step.kind === "demo-reply" ? (
            <ul className={styles.choices}>
              {DEMO_CHOICES.map((choice, position) => {
                const chosen = answer === choice.id;
                const reveal = Boolean(answer);
                return (
                  <motion.li key={choice.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: reveal && !chosen && !choice.correct ? 0.45 : 1, y: 0 }} transition={{ duration: 0.18, delay: reduce ? 0 : 0.05 + position * 0.04 }}>
                    <button
                      type="button"
                      className={styles.choice}
                      data-state={reveal ? (choice.correct ? "correct" : chosen ? "wrong" : "idle") : "idle"}
                      onClick={() => choose(choice.id)}
                      disabled={reveal}
                    >
                      <span className={styles.choiceLetter} aria-hidden="true">{String.fromCharCode(65 + position)}</span>
                      <span>{choice.label}</span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          ) : null}
          {step.kind === "demo-reply" && answer ? (
            <motion.p className={styles.feedback} data-correct={DEMO_CHOICES.find((choice) => choice.id === answer)?.correct ? "true" : "false"} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} role="status">
              {DEMO_CHOICES.find((choice) => choice.id === answer)?.feedback}
            </motion.p>
          ) : null}

          <div className={styles.actions}>
            {index > 0 && !isLast ? <button type="button" className={styles.secondary} onClick={back}>Voltar</button> : <span />}
            <button
              ref={primaryRef}
              type="button"
              className={styles.primary}
              onClick={next}
              disabled={step.kind === "demo-reply" && !answer}
            >
              {step.kind === "intro" ? "Começar o tour" : isLast ? "Começar a atender" : step.kind === "demo-reply" && !answer ? "Escolha uma resposta" : "Próximo"}
              {!isLast ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
            </button>
          </div>
        </motion.section>
      </AnimatePresence>
    </div>,
    document.body,
  );
}

const TEAM = [
  { shape: "mochi", hue: 212 },
  { shape: "onigiri", hue: 28 },
  { shape: "cubo", hue: 150 },
  { shape: "logo", hue: null },
  { shape: "favo", hue: 268 },
  { shape: "nuvem", hue: 330 },
  { shape: "salte", hue: 200 },
] as const;

function Team({ reduce }: { reduce: boolean }) {
  return (
    <div className={styles.team} aria-hidden="true">
      {TEAM.map((member, position) => (
        <motion.span
          key={member.shape}
          initial={reduce ? false : { opacity: 0, y: 24, scale: 0.5, rotate: position % 2 ? 8 : -8 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
          transition={{ type: "spring", visualDuration: 0.45, bounce: 0.4, delay: reduce ? 0 : 0.12 + position * 0.06 }}
        >
          <motion.span
            style={{ display: "inline-grid" }}
            animate={reduce ? undefined : { y: [0, -4, 0] }}
            transition={reduce ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: position * 0.2 }}
          >
            <AssistantAvatar shape={member.shape} hue={member.hue} size={position === 3 ? 56 : 42} />
          </motion.span>
        </motion.span>
      ))}
    </div>
  );
}

function Badge({ xp, maxXp, reduce }: { xp: number; maxXp: number; reduce: boolean }) {
  return (
    <div className={styles.badgeWrap}>
      <motion.div
        className={styles.badge}
        initial={reduce ? false : { scale: 0.2, rotate: -40, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", visualDuration: 0.6, bounce: 0.45, delay: reduce ? 0 : 0.1 }}
      >
        <AssistantAvatar shape="logo" hue={null} size={64} />
      </motion.div>
      <motion.p className={styles.badgeLabel} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 0.45 }}>
        Selo: Pronto para atender · {xp} de {maxXp} XP
      </motion.p>
    </div>
  );
}

/** Deterministic "random" in [0, 1): same confetti every render, no impure calls. */
function scatter(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

const CONFETTI_COLORS = ["oklch(66% .17 212)", "oklch(72% .17 28)", "oklch(68% .17 150)", "oklch(64% .19 268)", "oklch(70% .17 330)", "oklch(80% .15 85)"];

function Confetti() {
  const pieces = useMemo(
    () => Array.from({ length: 46 }, (_, position) => ({
      id: position,
      left: scatter(position, 1) * 100,
      delay: scatter(position, 2) * 0.35,
      drift: (scatter(position, 3) - 0.5) * 160,
      rotate: (scatter(position, 4) - 0.5) * 540,
      size: 6 + scatter(position, 5) * 6,
      color: CONFETTI_COLORS[position % CONFETTI_COLORS.length],
      round: position % 3 === 0,
      duration: 2.4 + scatter(position, 6),
    })),
    [],
  );
  return (
    <div className={styles.confetti} aria-hidden="true">
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          style={{ left: `${piece.left}%`, width: piece.size, height: piece.round ? piece.size : piece.size * 0.45, background: piece.color, borderRadius: piece.round ? 999 : 2 }}
          initial={{ y: -30, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "105vh", x: piece.drift, rotate: piece.rotate, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: piece.duration, delay: piece.delay, ease: [0.2, 0.6, 0.4, 1] }}
        />
      ))}
    </div>
  );
}
