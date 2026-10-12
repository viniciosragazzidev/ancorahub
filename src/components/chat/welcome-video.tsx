"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { useMediaQuery } from "@/hooks/use-media-query";

import styles from "./welcome-video.module.css";

/** Narration of the video, for screen readers (the video has burned-in captions too). */
const TRANSCRIPT =
  "Olá, corretor! Seu dia de corretor acabou de mudar. Apresentamos o novo app do corretor da Âncora. Tudo o que importa agora cabe numa conversa. Seus assistentes acompanham cada lead, cada prazo e cada plantão, e te dizem qual é a próxima coisa a fazer. O lead chega, você aceita com um toque, e já está falando com o cliente. Conecte o seu WhatsApp, e a mensagem sai direto do app, com toda a conversa num lugar só. Seus retornos ficam na Agenda. Seus plantões, na escala. E a sua fila, organizada por dia e horário. E cada etapa que você registra conta. Mostra o seu trabalho para a gestão, ajuda a entender o que funciona, e vira pontos, missões e conquistas na sua jornada. Ficou com dúvida? Pergunte onde fica, e o app te leva até lá. A Âncora está sempre evoluindo, pensando em quem está na linha de frente: você. Bem-vindo. Vamos juntos.";

const SOURCES = {
  phone: { src: "/onboarding/video/boas-vindas-celular.mp4", poster: "/onboarding/video/poster-celular.jpg" },
  desktop: { src: "/onboarding/video/boas-vindas-computador.mp4", poster: "/onboarding/video/poster-computador.jpg" },
};

/**
 * The 1-minute welcome video on the broker's first access (before the welcome
 * card and the tour). It never autoplays: one tap plays it with sound, and
 * "Pular" is always there. Ending or skipping calls onDone.
 */
export function WelcomeVideo({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  const desktop = useMediaQuery("(min-width: 1024px) and (min-aspect-ratio: 4/3)");
  const media = desktop ? SOURCES.desktop : SOURCES.phone;
  const videoRef = useRef<HTMLVideoElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<"ready" | "playing" | "paused">("ready");
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => { playRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onDone(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  function play() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    void video.play().then(() => setState("playing")).catch(() => {
      // Some browsers refuse sound without a fresh gesture: start muted, the sound button stays one tap away.
      video.muted = true;
      setMuted(true);
      void video.play().then(() => setState("playing")).catch(() => undefined);
    });
  }

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) play();
    else { video.pause(); setState("paused"); }
  }

  return (
    <motion.div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Vídeo de boas-vindas do app do corretor"
      aria-describedby="welcome-video-transcript"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.16 } }}
    >
      <p id="welcome-video-transcript" className={styles.srOnly}>{TRANSCRIPT}</p>
      <motion.div
        className={styles.frame}
        data-layout={desktop ? "desktop" : "phone"}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.165, 0.84, 0.44, 1] }}
      >
        <video
          key={media.src}
          ref={videoRef}
          className={styles.video}
          src={media.src}
          poster={media.poster}
          playsInline
          preload="metadata"
          onClick={toggle}
          onTimeUpdate={(event) => { const v = event.currentTarget; if (v.duration) setProgress(v.currentTime / v.duration); }}
          onEnded={onDone}
          aria-hidden="true"
        />

        {state !== "playing" ? (
          <div className={styles.center}>
            <button ref={playRef} type="button" className={styles.play} onClick={play}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor" /></svg>
              {state === "paused" ? "Continuar" : "Assistir · 1 min"}
            </button>
          </div>
        ) : null}

        <div className={styles.top}>
          {state !== "ready" ? (
            <button
              type="button"
              className={styles.round}
              onClick={() => { const v = videoRef.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); }}
              aria-label={muted ? "Ligar o som" : "Desligar o som"}
            >
              {muted
                ? <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" /><path d="M17 9l4 6M21 9l-4 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                : <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
            </button>
          ) : <span />}
          <button type="button" className={styles.skip} onClick={onDone}>Pular</button>
        </div>

        <div className={styles.progress} aria-hidden="true"><i style={{ transform: `scaleX(${progress})` }} /></div>
      </motion.div>
    </motion.div>
  );
}
