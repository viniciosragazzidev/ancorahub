"use client";

import { useSyncExternalStore } from "react";

/**
 * Um relógio só por página (status vivos, 27/10): um `setInterval` de 1 s compartilhado por todas as contagens,
 * parado com a aba oculta. Mesmo padrão do `useMinuteClock`: o snapshot do servidor é `null`, então o primeiro
 * render (SSR e hidratação) mostra a hora absoluta e só depois o cliente troca para a contagem. Nada de
 * `Date.now()` no primeiro render.
 */
const listeners = new Set<() => void>();
let current = 0;
let timer: number | null = null;

function emit() {
  current = Math.floor(Date.now() / 1000) * 1000;
  for (const listener of listeners) listener();
}

function start() {
  if (timer !== null || document.visibilityState === "hidden") return;
  emit();
  timer = window.setInterval(emit, 1000);
}

function stop() {
  if (timer === null) return;
  window.clearInterval(timer);
  timer = null;
}

function onVisibility() {
  if (document.visibilityState === "hidden") stop();
  else start();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", onVisibility);
    start();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      current = 0;
    }
  };
}

const getSnapshot = () => current;
const getServerSnapshot = () => 0;

/** Agora em ms, com tique de 1 s; null no servidor, na hidratação e antes do primeiro tique. */
export function useNowSeconds(): number | null {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return value || null;
}

/** Quanto falta até `at` (ms, nunca negativo); null enquanto o relógio do cliente não começou ou sem alvo. */
export function useCountdown(at: string | null | undefined): number | null {
  const now = useNowSeconds();
  if (!at || now === null) return null;
  const target = new Date(at).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, target - now);
}

/** Só para testes: zera o relógio compartilhado. */
export function resetCountdownClockForTests() {
  stop();
  listeners.clear();
  current = 0;
}
