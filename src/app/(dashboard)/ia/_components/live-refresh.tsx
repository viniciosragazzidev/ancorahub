"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Mantém o resumo vivo: relê a página no servidor a cada minuto enquanto a aba está à vista. Nível 0 de
 * feedback (FEEDBACK.md): sem som, sem aviso; só os números mudam.
 */
export function LiveRefresh({ everyMs = 60_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => window.clearInterval(timer);
  }, [everyMs, router]);
  return null;
}
