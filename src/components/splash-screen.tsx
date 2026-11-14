"use client";

import { useEffect, useState } from "react";

import { MASCOT_VIDEO_FRAME, MASCOT_VIDEOS } from "@/components/mascot/mascot-config";

import { SPLASH_KEY } from "./splash-boot";

import styles from "./splash-screen.module.css";

export { SPLASH_KEY };
/** A entrada do mascote (0,4 s) não é cortada no meio; fora isso, nenhuma espera artificial. */
export const SPLASH_ENTRANCE_MS = 400;
export const SPLASH_EXIT_MS = 240;


type Phase = "showing" | "leaving" | "gone";

/**
 * Splash do PWA com o mascote (docs/design-system/MASCOTE.md §5).
 * - Fundo branco puro e o mascote centralizado, já no HTML do servidor (aparece antes do JavaScript,
 *   emendando com a tela branca do PWA instalado, que usa background_color #ffffff).
 * - Some quando o app está pronto: no primeiro quadro depois da hidratação, respeitando só os 0,4 s da
 *   entrada. Nunca espera a animação inteira.
 * - Uma vez por sessão do navegador. Movimento reduzido: mascote parado e saída sem transição.
 * - Não captura cliques (pointer-events: none) e é decorativa para leitor de tela.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>("showing");

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.splash === "done") {
      setPhase("gone");
      return;
    }
    try { sessionStorage.setItem(SPLASH_KEY, "1"); } catch { /* aba anônima: aparece de novo na próxima carga */ }

    const reduce = root.dataset.splash === "static" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    const timers: number[] = [];
    let frame = 0;
    const leave = () => {
      // Dois quadros: o conteúdo do app já pintou por baixo antes de a splash sair.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          setPhase("leaving");
          timers.push(window.setTimeout(() => {
            root.dataset.splash = "done";
            setPhase("gone");
          }, reduce ? 0 : SPLASH_EXIT_MS));
        });
      });
    };
    const wait = reduce ? 0 : Math.max(0, SPLASH_ENTRANCE_MS - performance.now());
    timers.push(window.setTimeout(leave, wait));
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  if (phase === "gone") return null;

  // Do repouso ao polegar levantado (animação pré-gravada, MASCOTE.md §5). Sem movimento: só o primeiro quadro.
  const clip = MASCOT_VIDEOS.leadAccepted;
  return (
    <div className={styles.splash} data-phase={phase} data-splash-screen="" aria-hidden="true">
      <div className={styles.content}>
      <div className={styles.stage}>
        {/* eslint-disable-next-line @next/next/no-img-element -- quadro estático local, precisa estar no HTML antes do JS */}
        <img className={styles.still} src={clip.poster} width={MASCOT_VIDEO_FRAME.width} height={MASCOT_VIDEO_FRAME.height} alt="" fetchPriority="high" decoding="async" draggable={false} />
        <video className={styles.clip} src={clip.src} poster={clip.poster} width={MASCOT_VIDEO_FRAME.width} height={MASCOT_VIDEO_FRAME.height} autoPlay muted playsInline preload="auto" disablePictureInPicture />
      </div>
        {/* Logo da Âncora Saúde. A splash é sempre branca, então o logo nunca inverte no tema escuro. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- logo local, precisa estar no HTML antes do JS */}
        <img className={styles.logo} src="/logo.webp" width={3126} height={886} alt="" decoding="async" draggable={false} />
      </div>
    </div>
  );
}
