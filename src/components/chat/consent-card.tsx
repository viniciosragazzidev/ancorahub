"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import styles from "./chat.module.css";
import type { ChatBlock } from "./types";

type ConsentBlock = Extract<ChatBlock, { type: "consent" }>;

const DETAILS = [
  { label: "Quem processa", text: "OpenRouter, que repassa para provedores pagos (Claude, da Anthropic, ou o modelo aberto da OpenAI) que não guardam nem treinam com os dados. Só se eles falharem: Groq ou Google, nunca na conversa do lead." },
  { label: "Que dados", text: "Sua pergunta e o resumo do seu dia. Na conversa do lead, também o resumo e as últimas mensagens. Nomes vão abreviados; telefone, e-mail e CPF vão escondidos." },
  { label: "Onde", text: "Em servidores fora do Brasil." },
  { label: "Até quando", text: "Você pode desligar quando quiser, em Notificações." },
];

/**
 * "Usar IA nas tarefas?": asked once, before the first question to the AI.
 * One tap decides; the card then shows the answer instead of the buttons.
 */
export function ConsentCard({ block, onDecide }: { block: ConsentBlock; onDecide?: (block: ConsentBlock, allow: boolean) => Promise<boolean> }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "granted" | "declined">("idle");

  async function decide(allow: boolean) {
    if (!onDecide || state !== "idle") return;
    setState("busy");
    const ok = await onDecide(block, allow);
    setState(ok ? (allow ? "granted" : "declined") : "idle");
  }

  return (
    <section className={`${styles.card} ${styles.consentCard}`} aria-label="Usar IA nas tarefas?">
      <div className={styles.consentHead}>
        <span className={styles.consentGlow} aria-hidden="true">
          <svg viewBox="0 0 16 16" width="18" height="18"><path d="M8 1.8 9.4 6.6 14.2 8 9.4 9.4 8 14.2 6.6 9.4 1.8 8 6.6 6.6Z" fill="currentColor" /></svg>
        </span>
        <span>
          <span className={styles.cardTitle} style={{ display: "block" }}>Usar IA nas tarefas?</span>
          <span className={styles.cardSubtitle}>Para responder o que você escreve, eu uso IA de outras empresas.</span>
        </span>
      </div>
      <button type="button" className={styles.consentMore} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? "Esconder detalhes" : "Ver detalhes"}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.dl
            className={styles.consentDetails}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.165, 0.84, 0.44, 1] }}
          >
            {DETAILS.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.text}</dd>
              </div>
            ))}
          </motion.dl>
        ) : null}
      </AnimatePresence>
      {state === "granted" || state === "declined" ? (
        <p className={styles.consentDone} role="status">{state === "granted" ? "✓ Permitido" : "Agora não"}</p>
      ) : (
        <div className={styles.leadCardActions}>
          <button type="button" className={`${styles.leadCardAction} ${styles.leadCardPrimary}`} disabled={state === "busy"} onClick={() => void decide(true)}>Permitir</button>
          <button type="button" className={styles.leadCardAction} disabled={state === "busy"} onClick={() => void decide(false)}>Agora não</button>
        </div>
      )}
    </section>
  );
}
