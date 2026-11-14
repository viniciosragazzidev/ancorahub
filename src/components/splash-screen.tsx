"use client";

import { useEffect, useState } from "react";

import { SPLASH_KEY } from "./splash-boot";

import styles from "./splash-screen.module.css";

export { SPLASH_KEY };
/** A entrada do capitão (0,4 s) não é cortada no meio; fora isso, nenhuma espera artificial. */
export const SPLASH_ENTRANCE_MS = 400;
export const SPLASH_EXIT_MS = 240;


type Phase = "showing" | "leaving" | "gone";

/**
 * Splash do PWA com o capitão pirata e a marca ÂNCORA (arte original em design/mascote/splash/).
 * - Fundo #002B73 (o azul da arte) com o capitão e a marca, já no HTML do servidor (aparece antes do
 *   JavaScript, emendando com a tela do PWA instalado, que usa o mesmo azul em background_color).
 * - Some quando o app está pronto: no primeiro quadro depois da hidratação, respeitando só os 0,4 s da
 *   entrada. Nunca espera a animação inteira.
 * - Uma vez por sessão do navegador. Movimento reduzido: arte parada e saída sem transição.
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

  // Arte da splash aprovada em 14/11/2026 (design/mascote/splash/): o capitão e a marca ÂNCORA, separados
  // para o capitão entrar e dar um pulinho enquanto a marca aparece logo depois. Fundo do mesmo azul da arte.
  return (
    <div className={styles.splash} data-phase={phase} data-splash-screen="" aria-hidden="true">
      <div className={styles.content}>
        {/* eslint-disable-next-line @next/next/no-img-element -- arte local, precisa estar no HTML antes do JS */}
        <img className={styles.hero} src="/mascote/splash-capitao.webp" width={645} height={735} alt="" fetchPriority="high" decoding="async" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element -- marca local, precisa estar no HTML antes do JS */}
        <img className={styles.wordmark} src="/mascote/splash-ancora.webp" width={710} height={240} alt="" decoding="async" draggable={false} />
      </div>
    </div>
  );
}
