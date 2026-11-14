"use client";

import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { isFirstTimeToday, markSeenToday } from "./first-time-today-core";

const noopSubscribe = () => () => {};

/**
 * Quanto tempo depois da montagem ainda vale decidir animar. Na carga completa
 * da página o movimento só fica ligado depois da hidratação (prefers-reduced-motion
 * no cliente e o kill-switch buscado em /api/public/interface-motion); passada
 * essa janela, a tela já foi vista parada e não anima mais.
 */
export const FIRST_TIME_TODAY_DECISION_WINDOW_MS = 2_000;

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * true quando esta montagem deve animar por ser a primeira do dia
 * (America/Sao_Paulo) para `key`; false nas seguintes.
 *
 * Em navegação interna a resposta sai já no primeiro render. No SSR e na
 * hidratação responde false (servidor e cliente iguais, sem mismatch) e a
 * decisão é tomada no cliente logo depois, num layout effect, assim que o
 * movimento estiver ligado (`enabled`). Por isso o valor pode virar de false
 * para true uma única vez: quem usa deve trocar a `key` do elemento animado
 * para que o `initial` do motion seja lido de novo.
 *
 * `enabled` false (movimento reduzido ou kill-switch) responde false e não
 * gasta a primeira vez do dia.
 */
export function useFirstTimeToday(key: string, enabled = true): boolean {
  const firstOnClient = useSyncExternalStore(
    noopSubscribe,
    () => isFirstTimeToday(safeLocalStorage(), key, new Date()),
    () => false,
  );
  const [animate, setAnimate] = useState(() => enabled && firstOnClient);
  const [windowOpen, setWindowOpen] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setWindowOpen(false), FIRST_TIME_TODAY_DECISION_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useLayoutEffect(() => {
    if (animate || !windowOpen || !enabled) return;
    if (isFirstTimeToday(safeLocalStorage(), key, new Date())) setAnimate(true);
  }, [animate, windowOpen, enabled, key]);

  useEffect(() => {
    if (animate) markSeenToday(safeLocalStorage(), key, new Date());
  }, [animate, key]);

  return animate;
}
