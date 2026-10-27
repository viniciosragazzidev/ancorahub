"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { LiteLiveStatusStrip } from "@/components/lite/status/live-status";
import { REALTIME_SYNC_BROWSER_EVENT, type RealtimeSyncBrowserDetail } from "@/components/providers/realtime-events";

import type { LiveStatusPayload } from "../types";

/** Busca de novo a cada 60 s com a aba visível (padrão do celebration-host). */
export const LIVE_STATUS_POLL_MS = 60_000;
/** Contagem chegou a zero: o robô roda em degraus de 1, 2 ou 5 min; espera um pouco antes de buscar. */
export const LIVE_STATUS_DUE_GRACE_MS = 20_000;
/** Sinais do tempo real chegam em rajada: junta numa busca só. */
export const LIVE_STATUS_SIGNAL_DEBOUNCE_MS = 3_000;
/** Domínios do tempo real que não mudam nenhum status vivo. */
const IGNORED_DOMAINS = new Set(["conversations", "whatsapp_connection"]);

/**
 * Mantém a faixa viva sem recarregar a página: primeira pintura com o dado do servidor; depois GET /api/live-status
 * a cada 60 s (aba visível), quando uma contagem chega a zero e quando o tempo real avisa que leads ou equipe
 * mudaram. Sem router.refresh: só a faixa troca. Se a página recarregar (router.refresh), o dado novo do servidor vence.
 */
export function useLiveStatuses(initial: LiveStatusPayload) {
  const [fetched, setFetched] = useState<{ basis: LiveStatusPayload; payload: LiveStatusPayload } | null>(null);
  const lastFetchAt = useRef(0);
  const inFlight = useRef(false);
  const initialRef = useRef(initial);
  useEffect(() => { initialRef.current = initial; }, [initial]);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    lastFetchAt.current = Date.now();
    const basis = initialRef.current;
    try {
      const response = await fetch("/api/live-status", { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as LiveStatusPayload & { enabled?: boolean };
      setFetched({ basis, payload: { statuses: body.statuses ?? [], seals: body.seals ?? [] } });
    } catch {
      // Sem rede: mantém o último dado; a próxima rodada tenta de novo.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    lastFetchAt.current = Date.now();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, LIVE_STATUS_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetchAt.current >= LIVE_STATUS_POLL_MS) void refresh();
    };
    let signalTimer: number | null = null;
    const onSignal = (event: Event) => {
      const detail = (event as CustomEvent<RealtimeSyncBrowserDetail>).detail;
      if (detail?.kind !== "domain.invalidated" || IGNORED_DOMAINS.has(detail.domain ?? "")) return;
      if (signalTimer !== null) window.clearTimeout(signalTimer);
      signalTimer = window.setTimeout(() => { signalTimer = null; void refresh(); }, LIVE_STATUS_SIGNAL_DEBOUNCE_MS);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(REALTIME_SYNC_BROWSER_EVENT, onSignal);
    return () => {
      window.clearInterval(interval);
      if (signalTimer !== null) window.clearTimeout(signalTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(REALTIME_SYNC_BROWSER_EVENT, onSignal);
    };
  }, [refresh]);

  const dueTimer = useRef<number | null>(null);
  useEffect(() => () => { if (dueTimer.current !== null) window.clearTimeout(dueTimer.current); }, []);
  const onDue = useCallback(() => {
    if (dueTimer.current !== null) return;
    dueTimer.current = window.setTimeout(() => { dueTimer.current = null; void refresh(); }, LIVE_STATUS_DUE_GRACE_MS);
  }, [refresh]);

  const payload = fetched && fetched.basis === initial ? fetched.payload : initial;
  return { payload, onDue, refresh };
}

export function LiveStatusHost({ initial, title, className }: { initial: LiveStatusPayload; title?: string; className?: string }) {
  const { payload, onDue } = useLiveStatuses(initial);
  return <LiteLiveStatusStrip statuses={payload.statuses} seals={payload.seals} title={title} onDue={onDue} className={className} />;
}
