"use client";

import { useEffect, useRef, useState } from "react";

import { SPLASH_KEY } from "./splash-boot";

import styles from "./splash-screen.module.css";

export { SPLASH_KEY };
/** Duração da animação do capitão (splash-screen.module.css, splashHero). A splash fica até ela terminar. */
export const SPLASH_ANIMATION_MS = 1900;
/** Teto de segurança: mesmo que a animação não informe o fim, a splash nunca passa disto. */
export const SPLASH_MAX_MS = 2600;
export const SPLASH_EXIT_MS = 240;


type Phase = "showing" | "leaving" | "gone";

/**
 * Instante (performance.now) em que a splash foi pintada: a primeira pintura com conteúdo, que é a própria
 * splash do HTML do servidor. Sem essa medida (navegador antigo), conta a partir de agora.
 */
function splashShownAt() {
  try {
    const paint = performance.getEntriesByName?.("first-contentful-paint")[0] ?? performance.getEntriesByName?.("first-paint")[0];
    if (paint && paint.startTime > 0) return paint.startTime;
  } catch { /* sem Paint Timing */ }
  return performance.now();
}

/**
 * Splash do PWA com o capitão pirata e a marca ÂNCORA (arte original em design/mascote/splash/).
 * - Fundo #002B73 (o azul da arte) com o capitão e a marca, já no HTML do servidor (aparece antes do
 *   JavaScript, emendando com a tela do PWA instalado, que usa o mesmo azul em background_color).
 * - Fica até o capitão terminar a animação (cerca de 1,9 s; a splash aparecia e sumia rápido demais) e
 *   o app já estar pronto por baixo. Nunca passa de 2,6 s.
 * - Uma vez por sessão do navegador. Movimento reduzido: arte parada e saída sem transição.
 * - Não captura cliques (pointer-events: none) e é decorativa para leitor de tela.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>("showing");
  const hero = useRef<HTMLImageElement>(null);

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
    if (reduce) {
      leave();
    } else {
      // Espera a animação do capitão acabar (ela começa na primeira pintura, antes do JavaScript).
      let left = false;
      const once = () => { if (!left) { left = true; leave(); } };
      // Os prazos contam de quando a splash apareceu, não do início da navegação: no PWA o servidor pode levar
      // segundos para responder (a tela do sistema cobre essa espera) e, contando da navegação, a splash
      // sumia logo depois de aparecer.
      const shownAt = splashShownAt();
      const elapsed = Math.max(0, performance.now() - shownAt);
      const animation = hero.current?.getAnimations?.()[0];
      if (animation) void animation.finished.then(once, once);
      else timers.push(window.setTimeout(once, Math.max(0, SPLASH_ANIMATION_MS - elapsed)));
      timers.push(window.setTimeout(once, Math.max(0, SPLASH_MAX_MS - elapsed)));
    }
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
        <img ref={hero} className={styles.hero} src="/mascote/splash-capitao.webp" width={645} height={735} alt="" fetchPriority="high" decoding="async" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element -- marca local, precisa estar no HTML antes do JS */}
        <img className={styles.wordmark} src="/mascote/splash-ancora.webp" width={710} height={240} alt="" decoding="async" draggable={false} />
      </div>
    </div>
  );
}
