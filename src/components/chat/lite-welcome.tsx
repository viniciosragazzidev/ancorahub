"use client";

import { readSeen as readSeenMark, writeSeen } from "./tour/seen-storage";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { AssistantAvatar } from "./assistant-avatar";
import styles from "./lite-welcome.module.css";
import { startLiteTour } from "./tour/lite-tour";
import { WelcomeVideo } from "./welcome-video";
import { PushNudge } from "./push-nudge";
import { canAskForPush } from "@/features/notifications/push-ask";
import { useLightAvailabilityContext } from "@/components/light/light-availability-context";
import type { MascotShape } from "./types";

/** Bump the version to show the card again after a future redesign. */
const STORAGE_KEY = "ancora:lite-welcome:2026-10-chat";
const SUPERVISOR_STORAGE_KEY = "ancora:lite-welcome:2026-10-supervisor";
/** The welcome video (broker, Super-admin flag): seen once per device, before the card. */
const VIDEO_STORAGE_KEY = "ancora:welcome-video:2026-10-v2";
/** "Não perca nenhum lead": asked once per device (also for those who already saw the welcome). */
const PUSH_STORAGE_KEY = "ancora:push-nudge:2026-10";

const TEAM: Array<{ shape: MascotShape; hue: number | null }> = [
  { shape: "logo", hue: null },
  { shape: "mochi", hue: 212 },
  { shape: "onigiri", hue: 28 },
  { shape: "cubo", hue: 150 },
  { shape: "favo", hue: 268 },
  { shape: "nuvem", hue: 330 },
];

/** Supervisor Lite: the team's assistants and what the supervisor does with one tap. */
const SUPERVISOR_TEAM: Array<{ shape: MascotShape; hue: number | null }> = [
  { shape: "logo", hue: null },
  { shape: "mochi", hue: 150 },
  { shape: "cubo", hue: 212 },
  { shape: "nuvem", hue: 330 },
];
const SUPERVISOR_POINTS = [
  { title: "Sua equipe no Início", text: "Equipe, Leads da equipe e Desempenho mostram quem precisa de você agora." },
  { title: "Um toque resolve", text: "Cobrar, repassar um lead parado, mandar recado ou adicionar um corretor livre." },
  { title: "Alertas e resumo do dia", text: "Lead da equipe sem contato chega na Âncora, e às 19h vem o resumo." },
];

const POINTS = [
  { title: "Seus assistentes no Início", text: "Leads, Plantão, Agenda, Cotação e Desempenho dizem o que fazer agora." },
  { title: "Um toque resolve", text: "As opções aparecem como respostas prontas: aceitar, chamar no WhatsApp, agendar." },
  { title: "Lead novo no topo da tela", text: "O aviso desce do topo; toque em Atender e a conversa abre." },
];

function readSeen(key: string) {
  try {
    return readSeenMark(key) === "1";
  } catch {
    return true; // Storage blocked: never trap the broker behind the card.
  }
}

/**
 * Welcome card shown once per device when the broker first opens the new
 * Lite (chat) app: the team of assistants lands one by one, then three short
 * points and one button. Remembered in localStorage (a per-viewer convenience).
 */
export function LiteWelcome({ variant = "broker" }: { variant?: "broker" | "supervisor" } = {}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  // What runs after the push step (the tour, when the broker chose it).
  const [afterPush, setAfterPush] = useState<(() => void) | null>(null);
  const shell = useLightAvailabilityContext();
  const isSupervisor = variant === "supervisor";
  const withVideo = !isSupervisor && Boolean(shell?.welcomeVideo);
  const storageKey = isSupervisor ? SUPERVISOR_STORAGE_KEY : STORAGE_KEY;
  const team = isSupervisor ? SUPERVISOR_TEAM : TEAM;
  const points = isSupervisor ? SUPERVISOR_POINTS : POINTS;

  useEffect(() => {
    // After mount only: the server render never shows it, so there is no flash or mismatch.
    const timer = window.setTimeout(() => {
      // First access: the video comes first, then the card (each remembered on its own).
      if (withVideo && !readSeen(VIDEO_STORAGE_KEY)) setVideoOpen(true);
      else if (!readSeen(storageKey)) setOpen(true);
      // Welcome already seen: still ask once to turn on notifications.
      else if (!isSupervisor && !readSeen(PUSH_STORAGE_KEY)) void canAskForPush().then((ask) => { if (ask) setPushOpen(true); });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [isSupervisor, storageKey, withVideo]);

  function finishVideo() {
    writeSeen(VIDEO_STORAGE_KEY, "1");
    setVideoOpen(false);
    if (!readSeen(storageKey)) window.setTimeout(() => setOpen(true), 220);
  }

  function close(next?: () => void) {
    writeSeen(storageKey, "1");
    setOpen(false);
    // Then the push step (once), and only after it the tour.
    // Broker only (the text speaks of the leads that reach him).
    void (isSupervisor || readSeen(PUSH_STORAGE_KEY) ? Promise.resolve(false) : canAskForPush()).then((ask) => {
      if (ask) {
        setAfterPush(() => next ?? null);
        window.setTimeout(() => setPushOpen(true), 240);
      } else if (next) window.setTimeout(next, 260);
    });
  }

  function closePush() {
    writeSeen(PUSH_STORAGE_KEY, "1");
    setPushOpen(false);
    const next = afterPush;
    setAfterPush(null);
    if (next) window.setTimeout(next, 260);
  }

  return (
    <AnimatePresence>
      {videoOpen ? <WelcomeVideo key="welcome-video" onDone={finishVideo} /> : null}
      {pushOpen ? <PushNudge key="push-nudge" onClose={closePush} /> : null}
      {open ? (
        <motion.div
          key="welcome"
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
          onClick={() => close()}
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
              {team.map((member, index) => (
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
              <h2 id="lite-welcome-title" className={styles.title}>{isSupervisor ? "Seu app de supervisor chegou" : "O app do corretor mudou"}</h2>
              <p className={styles.lead}>{isSupervisor ? "Bem-vindo! Sua equipe agora cabe numa conversa: os assistentes mostram quem precisa de você e você age com um toque." : "Bem-vindo! Agora tudo funciona como uma conversa: seus assistentes trazem o que fazer e você responde com um toque."}</p>
            </motion.div>

            <ul className={styles.points}>
              {points.map((point, index) => (
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
                onClick={() => close(startLiteTour)}
                autoFocus
                whileTap={reduce ? undefined : { scale: 0.97 }}
              >
                {isSupervisor ? "Fazer o tour (2 min)" : "Fazer o tour (3 min)"}
              </motion.button>
              <button type="button" className={styles.later} onClick={() => close()}>Agora não</button>
            </motion.div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
