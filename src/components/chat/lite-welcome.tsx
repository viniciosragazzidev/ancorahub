"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { AssistantAvatar } from "./assistant-avatar";
import styles from "./lite-welcome.module.css";
import { startLiteTour } from "./tour/lite-tour";
import type { MascotShape } from "./types";

/** Bump the version to show the card again after a future redesign. */
const STORAGE_KEY = "ancora:lite-welcome:2026-10-chat";

const TEAM: Array<{ shape: MascotShape; hue: number | null }> = [
  { shape: "logo", hue: null },
  { shape: "mochi", hue: 212 },
  { shape: "onigiri", hue: 28 },
  { shape: "cubo", hue: 150 },
  { shape: "favo", hue: 268 },
  { shape: "nuvem", hue: 330 },
];

const POINTS = [
  { title: "Seus assistentes no Início", text: "Leads, Plantão, Agenda, Cotação e Desempenho dizem o que fazer agora." },
  { title: "Um toque resolve", text: "As opções aparecem como respostas prontas: aceitar, chamar no WhatsApp, agendar." },
  { title: "Lead novo no topo da tela", text: "O aviso desce do topo; toque em Atender e a conversa abre." },
];

function readSeen() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true; // Storage blocked: never trap the broker behind the card.
  }
}

/**
 * Welcome card shown once per device when the broker first opens the new
 * Lite (chat) app: the team of assistants lands one by one, then three short
 * points and one button. Remembered in localStorage (a per-viewer convenience).
 */
export function LiteWelcome() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // After mount only: the server render never shows it, so there is no flash or mismatch.
    const timer = window.setTimeout(() => { if (!readSeen()) setOpen(true); }, 350);
    return () => window.clearTimeout(timer);
  }, []);

  function close() {
    try { window.localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="welcome"
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
          onClick={close}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="lite-welcome-title"
            className={styles.card}
            onClick={(event) => event.stopPropagation()}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <div className={styles.team} aria-hidden="true">
              {TEAM.map((member, index) => (
                <motion.span
                  key={member.shape}
                  className={styles.member}
                  initial={reduce ? false : { opacity: 0, y: 18, scale: 0.6 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", visualDuration: 0.42, bounce: 0.35, delay: reduce ? 0 : 0.15 + index * 0.07 }}
                >
                  <AssistantAvatar shape={member.shape} hue={member.hue} size={44} state={index === 1 ? "working" : "idle"} />
                </motion.span>
              ))}
            </div>

            <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: reduce ? 0 : 0.55 }}>
              <span className={styles.tag}>Novidade</span>
              <h2 id="lite-welcome-title" className={styles.title}>O app do corretor mudou</h2>
              <p className={styles.lead}>Bem-vindo! Agora tudo funciona como uma conversa: seus assistentes trazem o que fazer e você responde com um toque.</p>
            </motion.div>

            <ul className={styles.points}>
              {POINTS.map((point, index) => (
                <motion.li
                  key={point.title}
                  className={styles.point}
                  initial={reduce ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1], delay: reduce ? 0 : 0.7 + index * 0.08 }}
                >
                  <span className={styles.letter} aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                  <span>
                    <strong>{point.title}</strong>
                    <span className={styles.pointText}>{point.text}</span>
                  </span>
                </motion.li>
              ))}
            </ul>

            <motion.div
              className={styles.buttons}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: reduce ? 0 : 0.98 }}
            >
              <motion.button
                type="button"
                className={styles.start}
                onClick={() => { close(); window.setTimeout(startLiteTour, 260); }}
                autoFocus
                whileTap={reduce ? undefined : { scale: 0.97 }}
              >
                Fazer o tour (3 min)
              </motion.button>
              <button type="button" className={styles.later} onClick={close}>Agora não</button>
            </motion.div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
