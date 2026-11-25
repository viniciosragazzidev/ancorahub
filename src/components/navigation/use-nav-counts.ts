"use client";

import { useEffect, useState } from "react";

import type { NavCounts } from "@/shared/navigation/nav-counters";

/** A cada minuto com a aba visível, e de novo quando a pessoa volta para a aba. */
const REFRESH_MS = 60_000;

/** Contadores do menu lateral. Sem resposta, fica sem número (o menu nunca espera por eles). */
export function useNavCounts(enabled: boolean): NavCounts {
  const [counts, setCounts] = useState<NavCounts>({});

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let controller: AbortController | null = null;

    const load = async () => {
      if (document.visibilityState === "hidden") return;
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch("/api/nav-counts", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { counts?: NavCounts };
        if (active) setCounts(body.counts ?? {});
      } catch {
        // Rede caiu ou a busca foi trocada por outra: mantém o último número.
      }
    };

    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);

  return enabled ? counts : {};
}
