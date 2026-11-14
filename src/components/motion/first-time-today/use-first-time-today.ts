"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { isFirstTimeToday, markSeenToday } from "./first-time-today-core";

const noopSubscribe = () => () => {};

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * true na primeira montagem do dia (America/Sao_Paulo) para `key`; false nas
 * seguintes. A resposta é congelada na montagem, porque o `initial` do motion
 * só é lido ali. No SSR e na hidratação responde false (já visto), então a
 * hidratação não diverge e nada anima. `enabled` false (movimento reduzido ou
 * kill-switch) também responde false e não gasta a primeira vez do dia.
 */
export function useFirstTimeToday(key: string, enabled = true): boolean {
  const first = useSyncExternalStore(
    noopSubscribe,
    () => isFirstTimeToday(safeLocalStorage(), key, new Date()),
    () => false,
  );
  const [atMount] = useState(() => enabled && first);

  useEffect(() => {
    if (atMount) markSeenToday(safeLocalStorage(), key, new Date());
  }, [atMount, key]);

  return atMount;
}
