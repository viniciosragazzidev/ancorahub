"use client";

/**
 * LiteActionButton: o botão de ação do Lite com o feedback completo (docs/design-system/FEEDBACK.md §4).
 * Estados repouso, pressionado, enviando, confirmado e falhou, com largura fixa. O sucesso só aparece
 * depois que `onAction` resolve sem erro; a falha mostra a causa abaixo e volta como "Tentar de novo".
 * Som e vibração passam por useFeedback. Um por tela.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import { actionErrorMessage, isFailedResult, normalizeActionError } from "@/lib/feedback/action-error";
import { useFeedback } from "@/lib/feedback/use-feedback";
import { cn } from "@/lib/utils";

import styles from "./action-button.module.css";

export type LiteActionState = "idle" | "busy" | "done" | "error";
/** O que `onAction` pode devolver: nada ou { ok: true } é sucesso; { ok: false, ... } ou exceção é falha. */
export type LiteActionOutcome = void | { ok: true } | { ok: false; reason?: unknown; error?: unknown; message?: unknown; retryable?: boolean };

export interface LiteActionButtonProps {
  /** Rótulo em repouso: a ação ("Aceitar e chamar no WhatsApp"). */
  children: ReactNode;
  /** Enquanto espera o servidor ("Aceitando…"). */
  busyLabel: string;
  /** Depois de confirmado, nomeando o resultado ("Lead é seu"). */
  doneLabel: string;
  onAction: () => Promise<LiteActionOutcome>;
  /** Nível do sucesso: confirmação (padrão), marco no contexto ou celebração. */
  feedback?: "confirm" | "milestone" | "celebrate";
  /** Som de confirmação no nível 1. Só para ação ocasional; a de dezenas por dia fica em silêncio. */
  confirmSound?: boolean;
  /** Chave do limite diário do nível 2. */
  budgetKey?: string;
  /** O que continua valendo quando falha ("O lead continua esperando você."). */
  keeps?: string;
  /** Texto quando a causa não é legível. */
  errorFallback?: string;
  retryLabel?: string;
  /** Chamado depois do sucesso, com o plano de feedback (para o componente pai celebrar se puder). */
  onDone?: (celebrate: boolean) => void;
  size?: "md" | "sm";
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

function Check({ animate }: { animate: boolean }) {
  return (
    <motion.svg
      className={styles.icon}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      initial={animate ? { scale: 0.6, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={animate ? { opacity: { duration: motionTokens.duration.instant }, scale: motionTokens.spring.snappy } : { duration: 0 }}
    >
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        initial={{ pathLength: animate ? 0 : 1 }}
        animate={{ pathLength: 1 }}
        transition={animate ? { duration: motionTokens.duration.draw, ease: [...motionTokens.ease.standard] } : { duration: 0 }}
      />
    </motion.svg>
  );
}

function Cross({ animate }: { animate: boolean }) {
  return (
    <svg className={styles.icon} width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
      <motion.path d="M7 7l10 10" initial={{ pathLength: animate ? 0 : 1 }} animate={{ pathLength: 1 }} transition={{ duration: animate ? motionTokens.duration.standard : 0 }} />
      <motion.path d="M17 7L7 17" initial={{ pathLength: animate ? 0 : 1 }} animate={{ pathLength: 1 }} transition={{ duration: animate ? motionTokens.duration.standard : 0, delay: animate ? motionTokens.beat.text : 0 }} />
    </svg>
  );
}

const SHAKE = (() => {
  const d = motionTokens.shake.distance;
  const frames: number[] = [0];
  for (let i = 0; i < motionTokens.shake.cycles; i += 1) frames.push(-d, d);
  frames.push(0);
  return frames;
})();

export function LiteActionButton({
  children,
  busyLabel,
  doneLabel,
  onAction,
  feedback = "confirm",
  confirmSound = false,
  budgetKey,
  keeps,
  errorFallback,
  retryLabel = "Tentar de novo",
  onDone,
  size = "md",
  icon,
  disabled,
  className,
  "aria-label": ariaLabel,
}: LiteActionButtonProps) {
  const fire = useFeedback();
  const motionOn = useInterfaceMotionEnabled();
  const [state, setState] = useState<LiteActionState>("idle");
  const [retry, setRetry] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lockedWidth, setLockedWidth] = useState<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  const timers = useRef<number[]>([]);
  const errorId = useId();

  useEffect(() => {
    mounted.current = true;
    const pending = timers.current;
    return () => {
      mounted.current = false;
      pending.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function later(ms: number, run: () => void) {
    timers.current.push(window.setTimeout(() => { if (mounted.current) run(); }, ms));
  }

  function fail(cause: unknown) {
    const info = normalizeActionError(cause, errorFallback);
    setState("error");
    fire("error");
    // A causa chega no ritmo do texto (+80 ms), depois do X e do balanço.
    later(motionTokens.beat.text * 1000, () => setMessage(actionErrorMessage(info, keeps)));
    later(motionTokens.celebration.revertAfter * 1000, () => {
      setState("idle");
      setRetry(true);
      setLockedWidth(null);
      buttonRef.current?.focus({ preventScroll: true });
    });
  }

  async function run() {
    if (state === "busy" || state === "done" || disabled) return;
    setLockedWidth(buttonRef.current?.offsetWidth ?? null);
    setMessage(null);
    setState("busy");
    fire("tap");
    try {
      const outcome = await onAction();
      if (!mounted.current) return;
      if (isFailedResult(outcome)) return fail(outcome);
      const plan = fire(feedback, { sound: confirmSound, budgetKey });
      setState("done");
      onDone?.(plan.celebrate);
    } catch (error) {
      if (mounted.current) fail(error);
    }
  }

  const label =
    state === "busy" ? (<><span className={styles.spinner} aria-hidden="true" />{busyLabel}</>)
    : state === "done" ? (<><Check animate={motionOn} />{doneLabel}</>)
    : state === "error" ? (<><Cross animate={motionOn} />Não deu certo</>)
    : (<>{icon}{retry ? retryLabel : children}</>);

  return (
    <div className={cn(styles.wrap, className)}>
      <motion.button
        ref={buttonRef}
        type="button"
        className={cn(styles.button, size === "sm" && styles.sm)}
        data-state={state}
        aria-busy={state === "busy" || undefined}
        aria-label={state === "idle" && !retry ? ariaLabel : undefined}
        aria-describedby={message ? errorId : undefined}
        disabled={disabled || state === "done"}
        onClick={() => void run()}
        style={lockedWidth ? { minWidth: lockedWidth } : undefined}
        animate={state === "error" && motionOn ? { x: SHAKE } : { x: 0 }}
        transition={{ duration: motionTokens.shake.duration, ease: [...motionTokens.ease.inOut] }}
      >
        {/* Só entrada: o rótulo antigo sai na hora, então nunca empilha nem depende do fim de uma animação. */}
        <motion.span
            key={`${state}-${retry ? "retry" : "first"}`}
            className={styles.label}
            initial={state === "idle" && !retry ? false : motionOn ? { opacity: 0, y: motionTokens.distance.sm } : { opacity: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: motionOn ? motionTokens.duration.fast : motionTokens.duration.instant, ease: [...motionTokens.ease.enter], delay: state === "done" && motionOn ? motionTokens.beat.text : 0 }}
          >
            {label}
          </motion.span>
      </motion.button>
      {message ? <p id={errorId} role="alert" className={styles.error}>{message}</p> : null}
      {state === "done" ? <span role="status" className="sr-only">{doneLabel}</span> : null}
    </div>
  );
}
