"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import styles from "./lite-welcome.module.css";

type Result = "idle" | "busy" | "done" | "blocked" | "unavailable" | "error";

const MESSAGE: Partial<Record<Result, string>> = {
  blocked: "O navegador bloqueou os avisos. Libere em Configurações do navegador > Notificações e ative depois em Notificações, no app.",
  unavailable: "Os avisos não funcionam neste aparelho ainda. No iPhone, instale o app na tela de início primeiro.",
  error: "Não deu para ativar agora. Você pode ativar depois em Notificações, no app.",
};

/**
 * First access: one light step asking to turn on notifications, so no lead is
 * lost. One tap asks the browser; "Depois" never blocks. The bell rings, the
 * lead "lands" and a check closes it.
 */
export function PushNudge({ onClose }: { onClose: () => void }) {
  const reduce = useReducedMotion();
  const [result, setResult] = useState<Result>("idle");

  async function activate() {
    if (result === "busy") return;
    setResult("busy");
    // Loaded on tap: only this step pulls the push server actions.
    const outcome = await import("@/features/notifications/enable-push").then(({ enablePush }) => enablePush()).catch(() => ({ ok: false as const, reason: "error" as const }));
    if (outcome.ok) {
      setResult("done");
      window.setTimeout(onClose, 1300);
    } else setResult(outcome.reason);
  }

  return (
    <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.18 } }} onClick={onClose}>
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-nudge-title"
        className={styles.card}
        onClick={(event) => event.stopPropagation()}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98, transition: { duration: 0.2 } }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
      >
        <div className={styles.pushStage} aria-hidden="true">
          <motion.span
            className={styles.pushBell}
            data-done={result === "done"}
            animate={reduce || result === "done" ? { rotate: 0 } : { rotate: [0, -16, 14, -10, 8, -4, 0] }}
            transition={reduce || result === "done" ? { duration: 0.2 } : { duration: 1.1, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
          >
            {result === "done" ? (
              <svg viewBox="0 0 24 24" width="34" height="34"><motion.path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="34" height="34"><path d="M12 3a6 6 0 0 0-6 6v3.3L4.4 15.6h15.2L18 12.3V9a6 6 0 0 0-6-6ZM9.8 18.5a2.3 2.3 0 0 0 4.4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            )}
          </motion.span>
          {reduce || result === "done" ? null : (
            <motion.span
              className={styles.pushToast}
              initial={{ opacity: 0, y: -14, scale: 0.9 }}
              animate={{ opacity: [0, 1, 1, 0], y: [-14, 0, 0, -6], scale: [0.9, 1, 1, 0.96] }}
              transition={{ duration: 2.5, repeat: Infinity, times: [0, 0.18, 0.8, 1], delay: 0.4 }}
            >
              <span className={styles.pushToastDot} />Lead novo: Maria, PME 3 vidas
            </motion.span>
          )}
        </div>

        <span className={styles.tag}>Um passo rápido</span>
        <h2 id="push-nudge-title" className={styles.title}>{result === "done" ? "Avisos ligados!" : "Não perca nenhum lead"}</h2>
        <p className={styles.lead}>
          {result === "done"
            ? "Pronto. Lead novo, retorno e plantão chegam no seu celular, mesmo com o app fechado."
            : "Ative os avisos: quando um lead chegar para você, o celular toca na hora, mesmo com o app fechado. Lead que espera esfria."}
        </p>
        {MESSAGE[result] ? <p className={styles.pushError} role="alert">{MESSAGE[result]}</p> : null}

        {result === "done" ? null : (
          <div className={styles.buttons}>
            {result === "idle" || result === "busy" ? (
              <motion.button type="button" className={styles.start} onClick={() => void activate()} disabled={result === "busy"} autoFocus whileTap={reduce ? undefined : { scale: 0.97 }}>
                {result === "busy" ? "Ativando…" : "Ativar avisos"}
              </motion.button>
            ) : null}
            <button type="button" className={styles.later} onClick={onClose}>{result === "idle" || result === "busy" ? "Depois" : "Continuar"}</button>
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}
