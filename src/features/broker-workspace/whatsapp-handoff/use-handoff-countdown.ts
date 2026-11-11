"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const HANDOFF_SECONDS = 30;

export type HandoffCountdownState = "counting" | "paused" | "cancelled" | "done";

/**
 * Contagem regressiva do aceite com contador (11/11). Conta o tempo que falta, não uma hora-alvo:
 * com a aba ou o app no fundo, para; ao voltar, retoma de onde parou. `onZero` roda uma vez.
 */
export function useHandoffCountdown(input: { seconds?: number; active: boolean; onZero: () => void }) {
  const total = input.seconds ?? HANDOFF_SECONDS;
  const [remaining, setRemaining] = useState(total);
  const [state, setState] = useState<HandoffCountdownState>(input.active ? "counting" : "cancelled");
  const onZero = useRef(input.onZero);
  useEffect(() => {
    onZero.current = input.onZero;
  });
  const fired = useRef(false);

  useEffect(() => {
    if (state !== "counting" && state !== "paused") return;
    const onVisibility = () => setState((current) => current === "cancelled" || current === "done" ? current : document.hidden ? "paused" : "counting");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [state]);

  useEffect(() => {
    if (state !== "counting") return;
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => {
    if (state === "counting" && remaining === 0 && !fired.current) {
      fired.current = true;
      setState("done");
      onZero.current();
    }
  }, [remaining, state]);

  const cancel = useCallback(() => setState((current) => current === "done" ? current : "cancelled"), []);
  const finish = useCallback(() => {
    fired.current = true;
    setState("done");
  }, []);

  return { remaining, state, cancel, finish };
}
