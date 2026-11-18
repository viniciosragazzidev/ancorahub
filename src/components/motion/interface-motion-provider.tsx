"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { MotionConfig, useReducedMotion } from "motion/react";
import { useReducedMotionPreference } from "@/utils/animation/use-reduced-motion";
import { transitions } from "@/lib/motion";

/**
 * Movimento depende de três sinais (plano 2026-11-18, etapa 0):
 * 1. o sistema (`prefers-reduced-motion`);
 * 2. "Menos animação" do próprio app (`html[data-reduce-motion="1"]`, ver features/assist/a11y-prefs);
 * 3. o kill switch do super-admin (`feature_interface_motion_enabled`).
 * O provider junta os três em `html[data-interface-motion]`, que o CSS lê, e no `MotionConfig`.
 * Componentes leem com `useMotionAllowed()`.
 */

/** Valor do contexto: só o kill switch (true fora de provider). */
const InterfaceMotionContext = createContext(true);

function subscribeUserReduce(onChange: () => void) {
  if (typeof MutationObserver === "undefined") return () => undefined;
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduce-motion"] });
  return () => observer.disconnect();
}
const readUserReduce = () => document.documentElement.dataset.reduceMotion === "1";
const readServerUserReduce = () => false;

/** "Menos animação" ligado pelo usuário no app. */
export function useUserReducedMotion() {
  return useSyncExternalStore(subscribeUserReduce, readUserReduce, readServerUserReduce);
}

function subscribeSystemReduce(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const readSystemReduce = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const readServerSystemReduce = () => false;

/**
 * Pode animar? Junta sistema, "Menos animação" e kill switch.
 * No servidor e na hidratação responde "pode", para a marcação inicial de entrada
 * sair igual nos dois lados; a preferência vale logo depois de montar.
 */
export function useMotionAllowed() {
  const switchOn = useContext(InterfaceMotionContext);
  // O hook do motion e a leitura direta do matchMedia dizem a mesma coisa; os dois juntos cobrem o cache global do motion.
  const motionSystem = useReducedMotion() === true;
  const system = useSyncExternalStore(subscribeSystemReduce, readSystemReduce, readServerSystemReduce);
  const user = useUserReducedMotion();
  return switchOn && !motionSystem && !system && !user;
}

export function InterfaceMotionProvider({
  children,
  enabled,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  // Começa ligado (o padrão da chave é ligado); a API só desliga quando o kill switch está ativo.
  const [configuredEnabled, setConfiguredEnabled] = useState(true);
  const switchOn = enabled ?? configuredEnabled;
  const reducedMotion = useReducedMotionPreference();
  const userReduced = useUserReducedMotion();
  const motionEnabled = switchOn && !reducedMotion && !userReduced;

  useEffect(() => {
    if (enabled !== undefined) return;
    let disposed = false;
    let request: AbortController | null = null;
    async function refresh() {
      if (document.visibilityState === "hidden" || request) return;
      const controller = new AbortController();
      request = controller;
      const timeout = window.setTimeout(() => controller.abort(), 5_000);
      try {
        const response = await fetch("/api/public/interface-motion", {
          cache: "no-store",
          credentials: "omit",
          signal: controller.signal,
        });
        const data: unknown = response.ok ? await response.json() : null;
        if (!disposed)
          setConfiguredEnabled(
            typeof data === "object" && data !== null && "enabled" in data && data.enabled === true,
          );
      } catch {
        if (!disposed) setConfiguredEnabled(false);
      } finally {
        window.clearTimeout(timeout);
        request = null;
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      disposed = true;
      request?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [enabled]);

  useEffect(() => {
    document.documentElement.dataset.interfaceMotion = motionEnabled ? "on" : "off";
  }, [motionEnabled]);

  return (
    <InterfaceMotionContext.Provider value={switchOn}>
      <MotionConfig
        reducedMotion={motionEnabled ? "user" : "always"}
        transition={motionEnabled ? transitions.normal : { duration: 0 }}
      >
        {children}
      </MotionConfig>
    </InterfaceMotionContext.Provider>
  );
}

/** Como `useMotionAllowed`, mas trata o servidor como movimento reduzido (comportamento antigo, mantido para quem já usa). */
export function useInterfaceMotionEnabled() {
  const switchOn = useContext(InterfaceMotionContext);
  const reducedMotion = useReducedMotionPreference();
  const userReduced = useUserReducedMotion();
  return switchOn && !reducedMotion && !userReduced;
}

/** Compatibility adapter for components that already model a reduced state. */
export function useInterfaceReducedMotion() {
  return !useInterfaceMotionEnabled();
}
